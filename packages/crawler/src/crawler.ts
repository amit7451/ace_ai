import { assertValidSeedUrl } from './ssrf-guard';
import { safeFetch } from './safe-fetch';
import { loadRobotsPolicy } from './robots';
import { extractContent } from './html-extractor';
import { normalizeUrl, isSameOrigin, matchesAnyPattern, extractLinks } from './url-utils';
import { CrawlConfig, CrawlCallbacks, CrawlSummary, CRAWLER_DEFAULTS } from './types';

interface QueueItem {
  url: string;
  depth: number;
}

/**
 * Breadth-first website crawler: SSRF-guarded, robots.txt-aware,
 * same-origin-scoped, path-filtered, politely rate-limited per host, and
 * bounded on pages/depth/response size/redirects/wall-clock time per
 * request. Emits one `onPage` callback per page as soon as it's resolved,
 * so the caller (the worker's ingestion pipeline) can persist progress
 * incrementally rather than waiting for the whole crawl to finish.
 *
 * This class only crawls and extracts content — it has no idea what a
 * KnowledgeSource, Document, or embedding is. That wiring lives in
 * `apps/worker/src/pipeline/crawler.pipeline.ts`, same separation of
 * concerns as ai-core knowing nothing about organizations.
 */
export class WebsiteCrawler {
  async crawl(rawConfig: CrawlConfig, callbacks: CrawlCallbacks): Promise<CrawlSummary> {
    const config = {
      maxPages: CRAWLER_DEFAULTS.maxPages,
      maxDepth: CRAWLER_DEFAULTS.maxDepth,
      respectRobotsTxt: CRAWLER_DEFAULTS.respectRobotsTxt,
      sameOriginOnly: CRAWLER_DEFAULTS.sameOriginOnly,
      userAgent: CRAWLER_DEFAULTS.userAgent,
      requestTimeoutMs: CRAWLER_DEFAULTS.requestTimeoutMs,
      maxResponseBytes: CRAWLER_DEFAULTS.maxResponseBytes,
      defaultCrawlDelayMs: CRAWLER_DEFAULTS.defaultCrawlDelayMs,
      maxRedirects: CRAWLER_DEFAULTS.maxRedirects,
      concurrency: CRAWLER_DEFAULTS.concurrency,
      includePaths: [] as string[],
      excludePaths: [] as string[],
      ...rawConfig,
    };

    const log = callbacks.onLog ?? (() => {});

    // Cheap structural validation now; every actual request re-validates via
    // resolvePublicAddress() in safe-fetch.ts regardless, so this is a
    // fast-fail for obviously-bad input, not the security boundary itself.
    const seed = assertValidSeedUrl(config.seedUrl).toString();
    const normalizedSeed = normalizeUrl(seed);

    const alreadyCompleted = new Set(config.alreadyCompletedUrls ?? []);
    const visited = new Set<string>([normalizedSeed]);
    const queue: QueueItem[] = [{ url: normalizedSeed, depth: 0 }];

    let pagesDiscovered = 1;
    let pagesCompleted = 0;
    let pagesFailed = 0;
    let pagesSkipped = 0;
    let cancelled = false;
    let activeWorkers = 0;

    const lastRequestAtByHost = new Map<string, number>();

    const robotsPolicy = config.respectRobotsTxt
      ? await loadRobotsPolicy(seed, config.userAgent, log)
      : { isAllowed: () => true, crawlDelayMs: undefined as number | undefined };

    const politenessDelayMs = robotsPolicy.crawlDelayMs ?? config.defaultCrawlDelayMs;

    // Soft cap: with `concurrency` pages in flight at once, the true count
    // can overshoot maxPages by up to (concurrency - 1) — acceptable for a
    // page-count budget, and far simpler than coordinating an exact stop
    // across concurrent in-flight requests.
    const budgetReached = () => pagesCompleted + pagesFailed + pagesSkipped >= config.maxPages;

    const waitForPoliteness = async (hostname: string) => {
      const last = lastRequestAtByHost.get(hostname);
      if (last !== undefined) {
        const elapsed = Date.now() - last;
        if (elapsed < politenessDelayMs) {
          await new Promise((r) => setTimeout(r, politenessDelayMs - elapsed));
        }
      }
      lastRequestAtByHost.set(hostname, Date.now());
    };

    const processOne = async (item: QueueItem) => {
      const parsedUrl = new URL(item.url);

      if (matchesAnyPattern(parsedUrl.pathname, config.excludePaths)) {
        pagesSkipped++;
        await callbacks.onPage({
          url: item.url,
          depth: item.depth,
          status: 'SKIPPED',
          errorMessage: 'Excluded by excludePaths',
        });
        return;
      }
      if (
        config.includePaths.length > 0 &&
        !matchesAnyPattern(parsedUrl.pathname, config.includePaths)
      ) {
        pagesSkipped++;
        await callbacks.onPage({
          url: item.url,
          depth: item.depth,
          status: 'SKIPPED',
          errorMessage: 'Did not match includePaths',
        });
        return;
      }
      if (!robotsPolicy.isAllowed(item.url)) {
        pagesSkipped++;
        await callbacks.onPage({
          url: item.url,
          depth: item.depth,
          status: 'SKIPPED',
          errorMessage: 'Disallowed by robots.txt',
        });
        return;
      }

      await waitForPoliteness(parsedUrl.hostname);

      let res;
      try {
        res = await safeFetch(item.url, {
          userAgent: config.userAgent,
          timeoutMs: config.requestTimeoutMs,
          maxResponseBytes: config.maxResponseBytes,
          maxRedirects: config.maxRedirects,
          acceptContentType: (ct) => !!ct && ct.toLowerCase().includes('html'),
          onRedirect: (from, to) => log('info', `Redirect ${from} -> ${to}`),
        });
      } catch (err: any) {
        pagesFailed++;
        await callbacks.onPage({
          url: item.url,
          depth: item.depth,
          status: 'FAILED',
          errorMessage: err.message,
        });
        return;
      }

      if (res.statusCode >= 400) {
        pagesFailed++;
        await callbacks.onPage({
          url: item.url,
          depth: item.depth,
          status: 'FAILED',
          httpStatus: res.statusCode,
          errorMessage: `HTTP ${res.statusCode}`,
        });
        return;
      }

      const html = res.body.toString('utf-8');
      const { title, markdown } = extractContent(html);

      if (!markdown || markdown.length < 20) {
        pagesSkipped++;
        await callbacks.onPage({
          url: item.url,
          depth: item.depth,
          status: 'SKIPPED',
          httpStatus: res.statusCode,
          errorMessage: 'No extractable text content',
        });
      } else {
        pagesCompleted++;
        await callbacks.onPage({
          url: item.url,
          depth: item.depth,
          status: 'COMPLETED',
          httpStatus: res.statusCode,
          title,
          markdown,
          alreadyIngested: alreadyCompleted.has(item.url),
        });
      }

      if (item.depth < config.maxDepth) {
        const links = extractLinks(html, res.finalUrl);
        for (const link of links) {
          if (visited.has(link)) continue;
          if (config.sameOriginOnly && !isSameOrigin(link, seed)) continue;
          if (pagesDiscovered >= config.maxPages * 5) break; // hard cap on frontier growth for very large/looping sites
          visited.add(link);
          pagesDiscovered++;
          queue.push({ url: link, depth: item.depth + 1 });
        }
      }
    };

    const worker = async () => {
      while (true) {
        if (budgetReached()) return;
        if (callbacks.isCancelled && (await callbacks.isCancelled())) {
          cancelled = true;
          return;
        }

        const item = queue.shift();
        if (!item) {
          // Queue is empty right now, but another worker mid-flight may
          // still enqueue this page's links — only stop for good once
          // nobody is in a position to add more work.
          if (activeWorkers === 0) return;
          await new Promise((r) => setTimeout(r, 25));
          continue;
        }

        activeWorkers++;
        try {
          await processOne(item);
        } catch (err: any) {
          log('error', `Unexpected error processing ${item.url}: ${err.message}`);
          pagesFailed++;
          await callbacks.onPage({
            url: item.url,
            depth: item.depth,
            status: 'FAILED',
            errorMessage: err.message,
          });
        } finally {
          activeWorkers--;
        }
      }
    };

    const workerCount = Math.max(1, Math.min(config.concurrency, config.maxPages));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    return { pagesDiscovered, pagesCompleted, pagesFailed, pagesSkipped, cancelled };
  }
}

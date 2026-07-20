/**
 * Public configuration for a single crawl run. Everything here is either
 * user-supplied (via the API, persisted on `CrawlJob`) or a safe engine
 * default — there is deliberately no `concurrency` knob exposed to callers;
 * see README for why.
 */
export interface CrawlConfig {
  /** The seed URL to start crawling from. Must be absolute (http/https). */
  seedUrl: string;
  /** Hard cap on total pages fetched (successes + failures). Default 50. */
  maxPages?: number;
  /** Max link-hops from the seed URL. The seed itself is depth 0. Default 3. */
  maxDepth?: number;
  /** Glob-like patterns (`*`, `**`); a URL's pathname must match at least one to be crawled, when non-empty. */
  includePaths?: string[];
  /** Glob-like patterns; a URL's pathname matching any of these is skipped. Evaluated after includePaths. */
  excludePaths?: string[];
  /** Whether to fetch and honor robots.txt (Disallow/Allow/Crawl-delay). Default true. */
  respectRobotsTxt?: boolean;
  /** Restrict traversal to the seed's own hostname (www.-insensitive). Default true. */
  sameOriginOnly?: boolean;
  /** User-Agent header sent on every request, and the token robots.txt rules are matched against. */
  userAgent?: string;
  /** Per-request timeout in ms (connect + headers + body). Default 15000. */
  requestTimeoutMs?: number;
  /** Max response body size read, in bytes; larger responses are aborted mid-stream. Default 10MB. */
  maxResponseBytes?: number;
  /** Fallback delay (ms) between requests to the same host when robots.txt gives no Crawl-delay. Default 300. */
  defaultCrawlDelayMs?: number;
  /** Max redirect hops followed per request, re-validated (SSRF + robots + scope) at every hop. Default 5. */
  maxRedirects?: number;
  /**
   * Concurrent in-flight page fetches for this single crawl job. Intentionally
   * an engine-level constant, not part of the persisted/API-facing config —
   * exposing it would let a caller dial up a stampede against a third-party
   * site. Callers that construct `WebsiteCrawler` directly may still override
   * it (e.g. in tests); the platform's own pipeline never does.
   */
  concurrency?: number;
  /** URLs already known to be fully ingested (e.g. from a previous run of the same job); fetched again for link discovery but never re-reported as newly completed. */
  alreadyCompletedUrls?: Iterable<string>;
  /**
   * Called when a page's static HTML looks like a client-rendered SPA shell
   * with no real content in it (see content/spa-detection.ts) — wire this to
   * `new BrowserRenderer().render(url)` from browser-fetch.ts. Optional: if
   * omitted, thin/CSR pages are still reported via onPage as COMPLETED (with
   * whatever little text was found) or SKIPPED (if there was truly nothing) —
   * never silently dropped — you just won't recover the SPA's real content
   * without this wired in.
   */
  renderJsFallback?: (url: string) => Promise<{ html: string; finalUrl: string } | null>;
}

export type CrawledPageStatus = 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface CrawledPageResult {
  url: string;
  depth: number;
  status: CrawledPageStatus;
  httpStatus?: number;
  /** Present when status is FAILED or SKIPPED. */
  errorMessage?: string;
  /** Present when status is COMPLETED. Lightly-structured Markdown extracted from the page's main content. */
  markdown?: string;
  title?: string;
  /** True if this exact URL was already marked COMPLETED before this run (see `alreadyCompletedUrls`) — the caller should not re-ingest it. */
  alreadyIngested?: boolean;
}

export interface CrawlSummary {
  pagesDiscovered: number;
  pagesCompleted: number;
  pagesFailed: number;
  pagesSkipped: number;
  /** Set when the crawl stopped because `isCancelled()` returned true rather than running to completion. */
  cancelled: boolean;
}

export interface CrawlCallbacks {
  /** Invoked once per page as soon as it's been fetched (or definitively failed/skipped) — before its outgoing links are queued. */
  onPage: (result: CrawledPageResult) => Promise<void> | void;
  /**
   * Polled before each new page fetch starts. Returning true stops the crawl
   * as soon as in-flight fetches settle — used for user-triggered cancellation.
   */
  isCancelled?: () => Promise<boolean> | boolean;
  /** Optional structured logging hook; defaults to a no-op. */
  onLog?: (
    level: 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>
  ) => void;
}

export const CRAWLER_DEFAULTS = {
  maxPages: 50,
  maxDepth: 3,
  respectRobotsTxt: true,
  sameOriginOnly: true,
  userAgent: 'IonAI-Crawler/1.0 (+https://ion-ai.example/crawler-bot)',
  requestTimeoutMs: 15_000,
  maxResponseBytes: 10 * 1024 * 1024,
  defaultCrawlDelayMs: 300,
  maxRedirects: 5,
  concurrency: 3,
} as const;

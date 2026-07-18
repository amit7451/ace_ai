import crypto from 'node:crypto';
import { prisma } from '@ion-ai/database';
import { IStorageProvider } from '@ion-ai/storage';
import {
  KnowledgeProcessor,
  EmbeddingProviderFactory,
  VectorStoreProviderFactory,
} from '@ai-chatbot-platform/ai-core';
import { WebsiteCrawler, CrawledPageResult, CrawlConfig } from '@ion-ai/crawler';
import { CrawlJobPayload } from '@ion-ai/queue';
import { resolveEmbeddingProvider } from '../lib/resolve-embedding-provider';

/**
 * Turns one `CrawlJob` row into a running crawl: fetches pages via
 * `@ion-ai/crawler` (SSRF-guarded, robots-aware, same-origin-scoped), and
 * for each page that yields real content, runs it through the exact same
 * chunk -> embed -> upsert-to-Qdrant -> persist-to-Postgres path
 * `ingestion.pipeline.ts` uses for uploaded files — so a crawled page and an
 * uploaded PDF end up as indistinguishable `KnowledgeSource` rows to
 * everything downstream (the chat retriever, the Knowledge dashboard page).
 *
 * Progress is written to Postgres incrementally (one `CrawledPage` row per
 * page, `CrawlJob.pagesCrawled`/`pagesFailed` bumped after each), so the
 * API's `/crawlers/:id` and `/crawlers/:id/stream` endpoints reflect a
 * crawl's progress in real time rather than only on completion. A single
 * page's ingestion failure never aborts the rest of the crawl.
 */
export class CrawlerPipeline {
  constructor(
    private storageProvider: IStorageProvider,
    private qdrantUrl: string
  ) {}

  async processCrawlJob(job: CrawlJobPayload, _jobId: string): Promise<void> {
    console.log(`Starting crawl job ${job.crawlJobId} for org ${job.organizationId}: ${job.url}`);

    const crawlJob = await prisma.crawlJob.findUnique({ where: { id: job.crawlJobId } });
    if (!crawlJob) {
      console.error(`CrawlJob ${job.crawlJobId} not found; nothing to do.`);
      return;
    }
    if (crawlJob.organizationId !== job.organizationId) {
      // Defense in depth: the payload's organizationId should always match
      // the row's, but if it ever didn't, this is exactly the kind of
      // mismatch that must hard-stop rather than silently proceed.
      throw new Error(
        `CrawlJob ${job.crawlJobId} belongs to a different organization than the job payload claims.`
      );
    }

    await prisma.crawlJob.update({
      where: { id: job.crawlJobId },
      data: { status: 'RUNNING', startedAt: new Date(), errorDetails: null },
    });

    // Resumability: pages already successfully ingested in a previous run of
    // this same job (a prior partial failure, or a manual "Retry") are still
    // re-fetched for link discovery, but never re-embedded/re-billed.
    const existingCompletedPages = await prisma.crawledPage.findMany({
      where: { crawlJobId: job.crawlJobId, status: 'COMPLETED' },
      select: { url: true },
    });
    const alreadyCompletedUrls = new Set(existingCompletedPages.map((p) => p.url));

    let embeddingCtx: Awaited<ReturnType<typeof resolveEmbeddingProvider>>;
    try {
      embeddingCtx = await resolveEmbeddingProvider(job.organizationId);
    } catch (err: any) {
      await this.failJob(job.crawlJobId, `Could not resolve embedding provider: ${err.message}`);
      throw err;
    }

    const embedder = EmbeddingProviderFactory.create({
      provider: embeddingCtx.providerName as any,
      model: embeddingCtx.model,
      apiKey: embeddingCtx.apiKey ?? '',
    });

    const collectionName = `org_${job.organizationId.replace(/-/g, '_')}`;
    const vectorStore = VectorStoreProviderFactory.create({
      provider: 'qdrant',
      url: this.qdrantUrl,
    });
    // Collection creation needs a vector size, which we only learn from the
    // first successful embedBatch() result (same as ingestion.pipeline.ts) —
    // so it's created lazily on the first page that actually gets embedded,
    // not up front.
    let collectionReady = false;

    const onPage = async (page: CrawledPageResult): Promise<void> => {
      try {
        if (page.status !== 'COMPLETED') {
          await this.upsertPage(job.crawlJobId, page);
          await this.bumpCounts(job.crawlJobId);
          return;
        }

        const existing = await prisma.crawledPage.findUnique({
          where: { crawlJobId_url: { crawlJobId: job.crawlJobId, url: page.url } },
        });

        if (page.alreadyIngested || existing?.status === 'COMPLETED') {
          // Already embedded in a previous run of this job — the crawler
          // still fetched it (needed to rediscover its outgoing links), but
          // there's nothing new to store.
          await this.bumpCounts(job.crawlJobId);
          return;
        }

        const pageRow = await this.upsertPage(job.crawlJobId, page, 'PENDING');

        const markdown = page.markdown ?? '';
        const markdownBuffer = Buffer.from(markdown, 'utf-8');

        const knowledgeSource = await prisma.knowledgeSource.create({
          data: {
            organizationId: job.organizationId,
            status: 'PROCESSING',
            sourceType: 'WEBSITE',
          },
        });

        const storageKey = `crawl/${job.organizationId}/${job.crawlJobId}/${pageRow.id}.md`;
        await this.storageProvider.upload(storageKey, markdownBuffer, 'text/markdown');
        const hashSha256 = crypto.createHash('sha256').update(markdownBuffer).digest('hex');

        const document = await prisma.document.create({
          data: {
            knowledgeSourceId: knowledgeSource.id,
            storageKey,
            mimeType: 'text/markdown',
            sizeBytes: markdownBuffer.length,
            hashSha256,
          },
        });

        const processor = new KnowledgeProcessor();
        const chunks = processor.process(
          {
            content: markdown,
            mimeType: 'text/markdown',
            fileName: `${page.title || page.url}.md`,
            metadata: { url: page.url, title: page.title },
          },
          {
            tenantId: job.organizationId,
            assistantId: 'default',
            documentId: document.id,
            sourceType: 'website',
          }
        );

        const chunkTexts = chunks.map((c) => c.text);
        const embeddings = await embedder.embedBatch(chunkTexts);

        if (!collectionReady) {
          await vectorStore.getOrCreateCollection({
            name: collectionName,
            vectorSize: embeddings.dimensions,
            distance: 'cosine',
          });
          collectionReady = true;
        }

        const vectors = chunks.map((c, i) => {
          const { metadata, ...core } = c;
          const payload = metadata ? { ...core, ...metadata } : { ...core };
          return {
            id: c.chunkId,
            vector: embeddings.embeddings[i].embedding,
            payload: {
              ...payload,
              organizationId: job.organizationId,
              knowledgeSourceId: knowledgeSource.id,
            },
          };
        });

        await vectorStore.upsertBatch(collectionName, vectors);

        for (const vector of vectors) {
          await prisma.chunk.create({
            data: {
              documentId: document.id,
              chunkIndex: vector.payload.chunkIndex as number,
              tokenCount: chunks[vector.payload.chunkIndex as number].tokenCount,
              vectorId: vector.id,
              metadata: ((vector.payload as any).metadata as any) ?? {},
            },
          });
        }

        await prisma.knowledgeSource.update({
          where: { id: knowledgeSource.id },
          data: { status: 'COMPLETED' },
        });

        await prisma.crawledPage.update({
          where: { id: pageRow.id },
          data: {
            status: 'COMPLETED',
            knowledgeSourceId: knowledgeSource.id,
            httpStatus: page.httpStatus,
            completedAt: new Date(),
          },
        });

        await this.bumpCounts(job.crawlJobId);
      } catch (err: any) {
        // A single page's ingestion failing (bad embedding response, R2
        // hiccup, etc.) must not take the rest of a 50-page crawl down with
        // it — record it as a failed page and keep going.
        console.error(`Failed to ingest ${page.url} (crawl ${job.crawlJobId}):`, err);
        await this.upsertPage(
          job.crawlJobId,
          { ...page, status: 'FAILED', errorMessage: err.message ?? String(err) },
          'FAILED'
        );
        await this.bumpCounts(job.crawlJobId);
      }
    };

    let lastCancelCheckAt = 0;
    let cachedCancelled = false;
    const isCancelled = async (): Promise<boolean> => {
      const now = Date.now();
      // Re-check the DB at most every 2s (not on every page) — cancellation
      // doesn't need sub-second responsiveness, and this is called from
      // every idle worker in the crawler's internal pool.
      if (now - lastCancelCheckAt > 2000) {
        lastCancelCheckAt = now;
        const fresh = await prisma.crawlJob.findUnique({
          where: { id: job.crawlJobId },
          select: { status: true },
        });
        cachedCancelled = fresh?.status === 'CANCELLED';
      }
      return cachedCancelled;
    };

    const config: CrawlConfig = {
      seedUrl: crawlJob.url,
      maxPages: crawlJob.maxPages,
      maxDepth: crawlJob.maxDepth,
      includePaths: crawlJob.includePaths,
      excludePaths: crawlJob.excludePaths,
      respectRobotsTxt: crawlJob.respectRobotsTxt,
      sameOriginOnly: crawlJob.sameOriginOnly,
      alreadyCompletedUrls,
    };

    try {
      const summary = await new WebsiteCrawler().crawl(config, {
        onPage,
        isCancelled,
        onLog: (level, message) => {
          const line = `[crawl ${job.crawlJobId}] ${message}`;
          if (level === 'error') console.error(line);
          else if (level === 'warn') console.warn(line);
          else console.log(line);
        },
      });

      await prisma.crawlJob.update({
        where: { id: job.crawlJobId },
        data: {
          status: summary.cancelled ? 'CANCELLED' : 'COMPLETED',
          pagesDiscovered: summary.pagesDiscovered,
          finishedAt: new Date(),
        },
      });

      console.log(`Crawl ${job.crawlJobId} finished:`, summary);
    } catch (err: any) {
      console.error(`Crawl ${job.crawlJobId} failed:`, err);
      await this.failJob(job.crawlJobId, err.message ?? String(err));
      throw err; // let BullMQ record the job-level failure/retry too
    }
  }

  private async upsertPage(
    crawlJobId: string,
    page: CrawledPageResult,
    statusOverride?: 'PENDING' | 'FAILED'
  ) {
    const status = statusOverride ?? page.status;
    return prisma.crawledPage.upsert({
      where: { crawlJobId_url: { crawlJobId, url: page.url } },
      create: {
        crawlJobId,
        url: page.url,
        depth: page.depth,
        status,
        httpStatus: page.httpStatus,
        errorMessage: page.errorMessage,
        completedAt: status === 'PENDING' ? null : new Date(),
      },
      update: {
        status,
        httpStatus: page.httpStatus,
        errorMessage: page.errorMessage,
        completedAt: status === 'PENDING' ? null : new Date(),
      },
    });
  }

  private async bumpCounts(crawlJobId: string) {
    const [completed, failed] = await Promise.all([
      prisma.crawledPage.count({ where: { crawlJobId, status: 'COMPLETED' } }),
      prisma.crawledPage.count({ where: { crawlJobId, status: 'FAILED' } }),
    ]);
    await prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: { pagesCrawled: completed, pagesFailed: failed },
    });
  }

  private async failJob(crawlJobId: string, message: string) {
    await prisma.crawlJob.update({
      where: { id: crawlJobId },
      data: { status: 'FAILED', errorDetails: message, finishedAt: new Date() },
    });
  }
}

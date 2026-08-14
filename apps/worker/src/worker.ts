import { Worker, Job } from 'bullmq';
import { QueueName, JobName, UploadJobPayload, CrawlJobPayload } from '@ion-ai/queue';
import { R2StorageProvider } from '@ion-ai/storage';
import { logger } from '@ion-ai/logger';
import { IngestionPipeline } from './pipeline/ingestion.pipeline';
import { CrawlerPipeline } from './pipeline/crawler.pipeline';
import { env } from '@ion-ai/config';

export class WorkerApplication {
  private ingestionWorker: Worker;
  private crawlerWorker: Worker;
  private ingestionPipeline: IngestionPipeline;
  private crawlerPipeline: CrawlerPipeline;

  constructor() {
    const storageProvider = new R2StorageProvider({
      accountId: env.R2_ACCOUNT_ID ?? '',
      accessKeyId: env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? '',
      bucketName: env.R2_BUCKET_NAME ?? 'ion-ai-knowledge',
    });

    const qdrantUrl = env.QDRANT_URL ?? 'http://localhost:6333';

    this.ingestionPipeline = new IngestionPipeline(storageProvider, qdrantUrl);
    this.crawlerPipeline = new CrawlerPipeline(storageProvider, qdrantUrl);

    const connection = {
      host: env.REDIS_HOST ?? 'localhost',
      port: Number(env.REDIS_PORT ?? 6379),
      password: env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    };

    this.ingestionWorker = new Worker(QueueName.INGESTION, this.processIngestionJob.bind(this), {
      connection,
      concurrency: env.WORKER_INGESTION_CONCURRENCY,
    });

    this.ingestionWorker.on('completed', (job) => {
      logger.info(`Job ${job.id} on ${QueueName.INGESTION} completed`);
    });
    this.ingestionWorker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, error: err.message }, `Job on ${QueueName.INGESTION} failed`);
    });
    this.ingestionWorker.on('error', (err) => {
      logger.error({ error: err.message }, `Ingestion worker connection error`);
    });

    // Lower concurrency than ingestion: each crawl job already fans out
    // several concurrent page fetches internally (see
    // CRAWLER_DEFAULTS.concurrency in @ion-ai/crawler), so this bounds how
    // many *whole crawls* run at once platform-wide, not how many HTTP
    // requests are in flight — that's bounded separately, per job, by the
    // crawler engine itself.
    this.crawlerWorker = new Worker(QueueName.CRAWLER, this.processCrawlerJob.bind(this), {
      connection,
      concurrency: env.WORKER_CRAWLER_CONCURRENCY,
    });

    this.crawlerWorker.on('completed', (job) => {
      logger.info(`Crawl job ${job.id} completed`);
    });
    this.crawlerWorker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, error: err.message }, `Crawl job failed`);
    });
    this.crawlerWorker.on('error', (err) => {
      logger.error({ error: err.message }, `Crawler worker connection error`);
    });
  }

  private async processIngestionJob(job: Job) {
    if (job.name === JobName.UPLOAD) {
      await this.ingestionPipeline.processUploadJob(job.data as UploadJobPayload, job.id!);
    } else if (job.name === JobName.DELETE) {
      await this.ingestionPipeline.processDeleteJob(job.data as any, job.id!);
    } else {
      logger.warn(`Unknown job name on ${QueueName.INGESTION}: ${job.name}`);
    }
  }

  private async processCrawlerJob(job: Job) {
    if (job.name === JobName.CRAWL) {
      await this.crawlerPipeline.processCrawlJob(job.data as CrawlJobPayload, job.id!);
    } else {
      logger.warn(`Unknown job name on ${QueueName.CRAWLER}: ${job.name}`);
    }
  }

  async start() {
    logger.info('Worker started and listening for jobs');
  }

  async stop() {
    await Promise.all([this.ingestionWorker.close(), this.crawlerWorker.close()]);
  }
}

import { Worker, Job } from 'bullmq';
import { QueueName, JobName, UploadJobPayload, CrawlJobPayload } from '@ion-ai/queue';
import { R2StorageProvider } from '@ion-ai/storage';
import { IngestionPipeline } from './pipeline/ingestion.pipeline';
import { CrawlerPipeline } from './pipeline/crawler.pipeline';
import { env } from '@ion-ai/config';

export class WorkerApplication {
  private ingestionWorker: Worker;
  private crawlerWorker: Worker;
  private ingestionPipeline: IngestionPipeline;
  private crawlerPipeline: CrawlerPipeline;

  constructor() {
    console.log('[DEBUG] process.cwd() =', process.cwd());
    console.log('[DEBUG] env.R2_ACCOUNT_ID =', env.R2_ACCOUNT_ID);

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
    };

    this.ingestionWorker = new Worker(QueueName.INGESTION, this.processIngestionJob.bind(this), {
      connection,
      concurrency: 5,
    });

    this.ingestionWorker.on('completed', (job) => {
      console.log(`${job.id} has completed!`);
    });
    this.ingestionWorker.on('failed', (job, err) => {
      console.error(`${job?.id} has failed with ${err.message}`);
    });

    // Lower concurrency than ingestion: each crawl job already fans out
    // several concurrent page fetches internally (see
    // CRAWLER_DEFAULTS.concurrency in @ion-ai/crawler), so this bounds how
    // many *whole crawls* run at once platform-wide, not how many HTTP
    // requests are in flight — that's bounded separately, per job, by the
    // crawler engine itself.
    this.crawlerWorker = new Worker(QueueName.CRAWLER, this.processCrawlerJob.bind(this), {
      connection,
      concurrency: 2,
    });

    this.crawlerWorker.on('completed', (job) => {
      console.log(`Crawl job ${job.id} has completed!`);
    });
    this.crawlerWorker.on('failed', (job, err) => {
      console.error(`Crawl job ${job?.id} has failed with ${err.message}`);
    });
  }

  private async processIngestionJob(job: Job) {
    if (job.name === JobName.UPLOAD) {
      await this.ingestionPipeline.processUploadJob(job.data as UploadJobPayload, job.id!);
    } else if (job.name === JobName.DELETE) {
      await this.ingestionPipeline.processDeleteJob(job.data as any, job.id!);
    } else {
      console.warn(`Unknown job name on ${QueueName.INGESTION}: ${job.name}`);
    }
  }

  private async processCrawlerJob(job: Job) {
    if (job.name === JobName.CRAWL) {
      await this.crawlerPipeline.processCrawlJob(job.data as CrawlJobPayload, job.id!);
    } else {
      console.warn(`Unknown job name on ${QueueName.CRAWLER}: ${job.name}`);
    }
  }

  async start() {
    console.log('Worker started and listening for jobs...');
  }

  async stop() {
    await Promise.all([this.ingestionWorker.close(), this.crawlerWorker.close()]);
  }
}

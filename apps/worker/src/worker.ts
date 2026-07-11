import { Worker, Job } from 'bullmq';
import { QueueName, JobName, UploadJobPayload } from '@ion-ai/queue';
import { R2StorageProvider } from '@ion-ai/storage';
import { IngestionPipeline } from './pipeline/ingestion.pipeline';
import dotenv from 'dotenv';

dotenv.config();

export class WorkerApplication {
  private worker: Worker;
  private ingestionPipeline: IngestionPipeline;

  constructor() {
    const storageProvider = new R2StorageProvider({
      accountId: process.env.R2_ACCOUNT_ID ?? '',
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
      bucketName: process.env.R2_BUCKET_NAME ?? 'ion-ai-knowledge',
    });

    this.ingestionPipeline = new IngestionPipeline(
      storageProvider,
      process.env.QDRANT_URL ?? 'http://localhost:6333'
    );

    this.worker = new Worker(QueueName.INGESTION, this.processJob.bind(this), {
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
      concurrency: 5,
    });

    this.worker.on('completed', (job) => {
      console.log(`${job.id} has completed!`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`${job?.id} has failed with ${err.message}`);
    });
  }

  private async processJob(job: Job) {
    if (job.name === JobName.UPLOAD) {
      await this.ingestionPipeline.processUploadJob(job.data as UploadJobPayload, job.id!);
    } else {
      console.warn(`Unknown job name: ${job.name}`);
    }
  }

  async start() {
    console.log('Worker started and listening for jobs...');
  }

  async stop() {
    await this.worker.close();
  }
}

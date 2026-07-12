import { Queue } from 'bullmq';
import { QueueName, JobName } from '@ion-ai/queue';
import { env } from '@ion-ai/config';

async function run() {
  const queue = new Queue(QueueName.INGESTION, {
    connection: {
      host: env.REDIS_HOST ?? 'localhost',
      port: Number(env.REDIS_PORT ?? 6379),
    },
  });

  await queue.add(JobName.UPLOAD, {
    organizationId: 'test-org',
    knowledgeSourceId: 'test-source',
    documentId: 'test-doc',
    storageKey: 'dummy-test-key.txt',
    mimeType: 'text/plain',
  });

  console.log('Added dummy UPLOAD job to queue!');

  await queue.close();
}

run();

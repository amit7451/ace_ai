import { WorkerApplication } from './worker';
import { logger } from '@ion-ai/logger';

async function bootstrap() {
  const workerApp = new WorkerApplication();
  await workerApp.start();

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    await workerApp.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.info('SIGINT received. Shutting down gracefully...');
    await workerApp.stop();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start worker');
  process.exit(1);
});

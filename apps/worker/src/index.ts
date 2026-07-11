import { WorkerApplication } from './worker';

async function bootstrap() {
  const workerApp = new WorkerApplication();
  await workerApp.start();

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    await workerApp.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received. Shutting down gracefully...');
    await workerApp.stop();
    process.exit(0);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});

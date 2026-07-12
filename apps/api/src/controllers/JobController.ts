import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '@ion-ai/database';

export async function jobController(fastify: FastifyInstance) {
  fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOrganization);

  fastify.get('/', async (request: FastifyRequest) => {
    const { queueProvider } = await import('../di');
    const { QueueName } = await import('@ion-ai/queue');
    const isPaused = await queueProvider.isPaused(QueueName.INGESTION);

    const jobs = await prisma.ingestionJob.findMany({
      where: { knowledgeSource: { organizationId: request.organization!.id } },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: jobs, isPaused };
  });

  fastify.post('/:id/retry', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };

    const job = await prisma.ingestionJob.findUnique({
      where: { id },
      include: {
        knowledgeSource: {
          include: { document: true },
        },
      },
    });

    if (!job || job.knowledgeSource.organizationId !== request.organization!.id) {
      return reply.status(404).send({ success: false, error: 'Job not found' });
    }

    if (job.status !== 'FAILED') {
      return reply.status(400).send({ success: false, error: 'Only failed jobs can be retried' });
    }

    if (!job.knowledgeSource.document) {
      return reply.status(400).send({ success: false, error: 'No associated document found' });
    }

    // Re-enqueue job
    const { queueProvider } = await import('../di');
    const { QueueName, JobName } = await import('@ion-ai/queue');

    await queueProvider.addJob(QueueName.INGESTION, JobName.UPLOAD, {
      organizationId: request.organization!.id,
      knowledgeSourceId: job.knowledgeSourceId,
      documentId: job.knowledgeSource.document.id,
      storageKey: job.knowledgeSource.document.storageKey,
      mimeType: job.knowledgeSource.document.mimeType,
    });

    // Reset status
    await prisma.ingestionJob.update({
      where: { id },
      data: {
        status: 'PENDING',
        currentStage: 'UPLOADED',
        progress: 0,
        retryCount: { increment: 1 },
        failureReason: null,
      },
    });

    // Reset source status as well
    await prisma.knowledgeSource.update({
      where: { id: job.knowledgeSourceId },
      data: { status: 'PENDING' },
    });

    return { success: true };
  });

  fastify.post('/pause', async (request: FastifyRequest, reply) => {
    const { queueProvider } = await import('../di');
    const { QueueName } = await import('@ion-ai/queue');
    await queueProvider.pause(QueueName.INGESTION);
    return { success: true };
  });

  fastify.post('/resume', async (request: FastifyRequest, reply) => {
    const { queueProvider } = await import('../di');
    const { QueueName } = await import('@ion-ai/queue');
    await queueProvider.resume(QueueName.INGESTION);
    return { success: true };
  });

  fastify.delete('/failed', async (request: FastifyRequest, reply) => {
    const { queueProvider } = await import('../di');
    const { QueueName } = await import('@ion-ai/queue');
    await queueProvider.cleanFailed(QueueName.INGESTION);

    // Update DB
    await prisma.ingestionJob.deleteMany({
      where: {
        status: 'FAILED',
        knowledgeSource: { organizationId: request.organization!.id },
      },
    });

    return { success: true };
  });

  fastify.delete('/:id', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const { queueProvider } = await import('../di');
    const { QueueName } = await import('@ion-ai/queue');

    await queueProvider.removeJob(QueueName.INGESTION, id);
    await prisma.ingestionJob.deleteMany({
      where: { id, knowledgeSource: { organizationId: request.organization!.id } },
    });

    return { success: true };
  });

  fastify.get('/stream', async (request: FastifyRequest, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': request.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
    });
    reply.raw.flushHeaders();

    const { env } = await import('@ion-ai/config');
    const { QueueEvents, QueueName } = await import('@ion-ai/queue');

    const queueEvents = new QueueEvents(QueueName.INGESTION, {
      connection: {
        host: env.REDIS_HOST ?? 'localhost',
        port: Number(env.REDIS_PORT ?? 6379),
        password: env.REDIS_PASSWORD,
      },
    });

    // Send initial connection success
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const sendUpdate = async () => {
      try {
        const { queueProvider } = await import('../di');
        const { QueueName } = await import('@ion-ai/queue');
        const isPaused = await queueProvider.isPaused(QueueName.INGESTION);

        const jobs = await prisma.ingestionJob.findMany({
          where: { knowledgeSource: { organizationId: request.organization!.id } },
          orderBy: { createdAt: 'desc' },
        });
        reply.raw.write(`data: ${JSON.stringify({ type: 'update', jobs, isPaused })}\n\n`);
      } catch (err) {
        console.error('SSE Error fetching jobs:', err);
      }
    };

    // When events happen, just push the full updated list to keep it simple and perfectly synced
    queueEvents.on('waiting', sendUpdate);
    queueEvents.on('active', sendUpdate);
    queueEvents.on('completed', sendUpdate);
    queueEvents.on('failed', sendUpdate);
    queueEvents.on('progress', sendUpdate);
    queueEvents.on('paused', sendUpdate);
    queueEvents.on('resumed', sendUpdate);

    // Send initial list right away
    await sendUpdate();

    request.raw.on('close', () => {
      queueEvents.close();
    });

    reply.hijack();
  });
}

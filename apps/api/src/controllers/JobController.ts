import { FastifyInstance, FastifyRequest } from 'fastify';
import { jobService } from '../di';
import { Role } from '@ion-ai/auth';

export async function jobController(fastify: FastifyInstance) {
  fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOrganization);

  fastify.get('/', async (request: FastifyRequest) => {
    const { jobs, isPaused } = await jobService.getJobs(request.organization!.id);
    return { success: true, data: jobs, isPaused };
  });

  fastify.post('/:id/retry', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    await jobService.retryJob(request.organization!.id, id);
    return { success: true };
  });

  fastify.post('/pause', async (request: FastifyRequest, reply) => {
    await jobService.pauseJobs(request.memberRole! as Role);
    return { success: true };
  });

  fastify.post('/resume', async (request: FastifyRequest, reply) => {
    await jobService.resumeJobs(request.memberRole! as Role);
    return { success: true };
  });

  fastify.delete('/failed', async (request: FastifyRequest) => {
    await jobService.clearFailedJobs(request.organization!.id, request.memberRole! as Role);
    return { success: true };
  });

  fastify.delete('/:id', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    await jobService.deleteJob(request.organization!.id, id);
    return { success: true };
  });

  fastify.get('/stream', async (request: FastifyRequest, reply) => {
    const { env } = await import('@ion-ai/config');
    const corsHeaders: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    };

    const origin = request.headers.origin;
    if (origin && origin === env.FRONTEND_URL) {
      corsHeaders['Access-Control-Allow-Origin'] = env.FRONTEND_URL;
      corsHeaders['Access-Control-Allow-Credentials'] = 'true';
      corsHeaders['Vary'] = 'Origin';
    }

    reply.raw.writeHead(200, corsHeaders);
    reply.raw.flushHeaders();
    const { QueueEvents, QueueName } = await import('@ion-ai/queue');

    const queueEvents = new QueueEvents(QueueName.INGESTION, {
      connection: {
        host: env.REDIS_HOST ?? 'localhost',
        port: Number(env.REDIS_PORT ?? 6379),
        password: env.REDIS_PASSWORD,
      },
    });

    reply.raw.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    const sendUpdate = async () => {
      try {
        const { jobs, isPaused } = await jobService.getJobs(request.organization!.id);
        reply.raw.write(`data: ${JSON.stringify({ type: 'update', jobs, isPaused })}\n\n`);
      } catch (err) {
        console.error('SSE Error fetching jobs:', err);
      }
    };

    queueEvents.on('waiting', sendUpdate);
    queueEvents.on('active', sendUpdate);
    queueEvents.on('completed', sendUpdate);
    queueEvents.on('failed', sendUpdate);
    queueEvents.on('progress', sendUpdate);
    queueEvents.on('paused', sendUpdate);
    queueEvents.on('resumed', sendUpdate);

    await sendUpdate();

    request.raw.on('close', () => {
      queueEvents.close();
    });

    reply.hijack();
  });
}

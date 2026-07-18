import { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { CreateCrawlJobRequestSchema } from '@ion-ai/contracts';
import { crawlerService } from '../di';

export async function crawlerController(fastify: FastifyInstance) {
  fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOrganization);

  fastify.get('/', async (request: FastifyRequest) => {
    const crawlers = await crawlerService.getCrawlers(request.organization!.id);
    return { success: true, data: crawlers };
  });

  fastify.get('/:id', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    const crawler = await crawlerService.getCrawler(request.organization!.id, id);
    return { success: true, data: crawler };
  });

  fastify.post('/', async (request: FastifyRequest, reply) => {
    let input;
    try {
      input = CreateCrawlJobRequestSchema.parse(request.body);
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid crawl configuration.',
            details: err.issues,
          },
        });
      }
      throw err;
    }

    const crawler = await crawlerService.createCrawlJob(
      request.organization!.id,
      request.user.sub,
      request.memberRole!,
      input
    );
    return reply.status(201).send({ success: true, data: crawler });
  });

  fastify.post('/:id/retry', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    await crawlerService.retryCrawler(request.organization!.id, id, request.user.sub);
    return { success: true };
  });

  fastify.post('/:id/cancel', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    await crawlerService.cancelCrawler(request.organization!.id, id, request.user.sub);
    return { success: true };
  });

  fastify.delete('/:id', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    await crawlerService.deleteCrawler(
      request.organization!.id,
      id,
      request.memberRole!,
      request.user.sub
    );
    return { success: true };
  });

  // Live progress for a single crawl job. BullMQ's QueueEvents only fires on
  // job-level transitions (waiting/active/completed/failed) — a single crawl
  // can run for minutes and produce dozens of page-level updates within one
  // still-"active" job, so this also polls on an interval to reflect
  // page-by-page progress, not just start/end.
  fastify.get('/:id/stream', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const organizationId = request.organization!.id;

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

    const queueEvents = new QueueEvents(QueueName.CRAWLER, {
      connection: {
        host: env.REDIS_HOST ?? 'localhost',
        port: Number(env.REDIS_PORT ?? 6379),
        password: env.REDIS_PASSWORD,
      },
    });

    reply.raw.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    let closed = false;
    const sendUpdate = async () => {
      if (closed) return;
      try {
        const crawler = await crawlerService.getCrawler(organizationId, id);
        reply.raw.write(`data: ${JSON.stringify({ type: 'update', crawler })}\n\n`);
        if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(crawler.status)) {
          reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          cleanup();
        }
      } catch (err) {
        console.error('SSE error fetching crawler:', err);
      }
    };

    const pollInterval = setInterval(sendUpdate, 2000);
    queueEvents.on('completed', sendUpdate);
    queueEvents.on('failed', sendUpdate);
    queueEvents.on('active', sendUpdate);

    function cleanup() {
      if (closed) return;
      closed = true;
      clearInterval(pollInterval);
      queueEvents.close().catch(() => {});
      reply.raw.end();
    }

    await sendUpdate();
    request.raw.on('close', cleanup);
  });
}

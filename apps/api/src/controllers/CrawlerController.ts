import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '@ion-ai/database';

export async function crawlerController(fastify: FastifyInstance) {
  fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOrganization);

  fastify.get('/', async (request: FastifyRequest) => {
    const crawlers = await prisma.crawlJob.findMany({
      where: { organizationId: request.organization!.id },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: crawlers };
  });

  fastify.post('/', async (request: FastifyRequest) => {
    // Placeholder for crawler creation logic
    return { success: true, data: { message: 'Crawler endpoint registered' } };
  });

  fastify.post('/:id/retry', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };

    const crawler = await prisma.crawlJob.findUnique({
      where: { id },
    });

    if (!crawler || crawler.organizationId !== request.organization!.id) {
      return reply.status(404).send({ success: false, error: 'Crawler job not found' });
    }

    if (crawler.status !== 'FAILED') {
      return reply
        .status(400)
        .send({ success: false, error: 'Only failed crawlers can be retried' });
    }

    // Re-enqueue job
    const { queueProvider } = await import('../di');
    const { QueueName, JobName } = await import('@ion-ai/queue');

    await queueProvider.addJob(QueueName.CRAWLER, JobName.CRAWL, {
      organizationId: request.organization!.id,
      crawlJobId: crawler.id,
      url: crawler.url,
    });

    // Reset status
    await prisma.crawlJob.update({
      where: { id },
      data: {
        status: 'PENDING',
        errorDetails: null,
        pagesCrawled: 0,
      },
    });

    const { auditLogRepository } = await import('../di');
    await auditLogRepository.create({
      organizationId: request.organization!.id,
      action: 'CRAWL_RETRIED',
      actorId: request.user.sub,
      metadata: { crawlJobId: crawler.id, url: crawler.url },
    });

    return { success: true };
  });
}

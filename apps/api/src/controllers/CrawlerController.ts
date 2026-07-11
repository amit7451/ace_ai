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
}

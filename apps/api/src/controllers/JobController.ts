import { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from '@ion-ai/database';

export async function jobController(fastify: FastifyInstance) {
  fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOrganization);

  fastify.get('/', async (request: FastifyRequest) => {
    const jobs = await prisma.ingestionJob.findMany({
      where: { knowledgeSource: { organizationId: request.organization!.id } },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: jobs };
  });
}

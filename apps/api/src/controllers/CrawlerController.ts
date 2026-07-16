import { FastifyInstance, FastifyRequest } from 'fastify';
import { crawlerService } from '../di';

export async function crawlerController(fastify: FastifyInstance) {
  fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOrganization);

  fastify.get('/', async (request: FastifyRequest) => {
    const crawlers = await crawlerService.getCrawlers(request.organization!.id);
    return { success: true, data: crawlers };
  });

  fastify.post('/', async (request: FastifyRequest) => {
    // Placeholder for crawler creation logic
    return { success: true, data: { message: 'Crawler endpoint registered' } };
  });

  fastify.post('/:id/retry', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    await crawlerService.retryCrawler(request.organization!.id, id, request.user.sub);
    return { success: true };
  });
}

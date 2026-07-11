import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { knowledgeService } from '../di';

export async function knowledgeController(fastify: FastifyInstance) {
  // All routes here require authentication and organization context
  fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOrganization);

  fastify.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();
    if (!data) {
      throw Object.assign(new Error('No file provided'), { statusCode: 400 });
    }

    const buffer = await data.toBuffer();
    const result = await knowledgeService.processUpload(
      request.organization!.id,
      request.user.sub,
      buffer,
      data.mimetype,
      data.filename
    );

    return { success: true, data: result };
  });

  fastify.get('/', async (request: FastifyRequest) => {
    const sources = await knowledgeService.getKnowledgeSources(request.organization!.id);
    return { success: true, data: sources };
  });

  fastify.delete('/:id', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    await knowledgeService.deleteKnowledgeSource(request.organization!.id, id);
    return { success: true };
  });

  fastify.post('/search', async (request: FastifyRequest) => {
    // Placeholder for internal semantic search logic (using ai-core RAG retriever)
    return { success: true, data: { message: 'Search endpoint placeholder registered' } };
  });
}

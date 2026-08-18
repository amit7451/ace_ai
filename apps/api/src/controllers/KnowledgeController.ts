import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { knowledgeService } from '../di';
import { SearchKnowledgeRequestSchema } from '@ion-ai/contracts';

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

    // Enforce 5 MB limit per document
    if (buffer.length > 5 * 1024 * 1024) {
      throw Object.assign(new Error('File size exceeds maximum limit of 5 MB per document.'), {
        statusCode: 400,
      });
    }

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

  fastify.get('/:id/file', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const orgId = request.organization?.id || (request.query as any)?.orgId;
    const { signedUrl } = await knowledgeService.getSignedDocumentUrl(id, orgId);

    return reply.redirect(signedUrl);
  });

  fastify.delete('/:id', async (request: FastifyRequest) => {
    const { id } = request.params as { id: string };
    await knowledgeService.deleteKnowledgeSource(request.organization!.id, id, request.user.sub);
    return { success: true };
  });

  fastify.post('/search', async (request: FastifyRequest) => {
    const { query, topK, scoreThreshold } = SearchKnowledgeRequestSchema.parse(request.body);
    const result = await knowledgeService.searchKnowledge(request.organization!.id, query, {
      topK,
      scoreThreshold,
    });
    return { success: true, data: result };
  });

  fastify.post('/:id/retry', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    await knowledgeService.retryKnowledgeSource(request.organization!.id, id);
    return { success: true };
  });

  fastify.post('/reindex', async (request: FastifyRequest) => {
    const result = await knowledgeService.reindexAllDocuments(
      request.organization!.id,
      request.user.sub,
      request.memberRole!
    );
    return result;
  });
}

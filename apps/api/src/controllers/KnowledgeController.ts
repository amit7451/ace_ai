import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { knowledgeService } from '../di';
import { prisma } from '@ion-ai/database';
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

  fastify.post('/:id/retry', async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };

    const source = await prisma.knowledgeSource.findUnique({
      where: { id },
      include: {
        document: true,
        ingestionJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!source || source.organizationId !== request.organization!.id) {
      return reply.status(404).send({ success: false, error: 'Knowledge source not found' });
    }

    if (source.status !== 'FAILED') {
      return reply
        .status(400)
        .send({ success: false, error: 'Only failed sources can be retried' });
    }

    const latestJob = source.ingestionJobs[0];
    if (!latestJob || latestJob.status !== 'FAILED') {
      return reply.status(400).send({ success: false, error: 'No failed ingestion job found' });
    }

    if (!source.document) {
      return reply.status(400).send({ success: false, error: 'No associated document found' });
    }

    // Re-enqueue job
    const { queueProvider } = await import('../di');
    const { QueueName, JobName } = await import('@ion-ai/queue');

    await queueProvider.addJob(QueueName.INGESTION, JobName.UPLOAD, {
      organizationId: request.organization!.id,
      knowledgeSourceId: source.id,
      documentId: source.document.id,
      storageKey: source.document.storageKey,
      mimeType: source.document.mimeType,
    });

    // Reset job status
    await prisma.ingestionJob.update({
      where: { id: latestJob.id },
      data: {
        status: 'PENDING',
        currentStage: 'UPLOADED',
        progress: 0,
        retryCount: { increment: 1 },
        failureReason: null,
      },
    });

    // Reset source status
    await prisma.knowledgeSource.update({
      where: { id },
      data: { status: 'PENDING' },
    });

    return { success: true };
  });
}

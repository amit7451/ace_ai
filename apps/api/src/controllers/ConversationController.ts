import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@ion-ai/database';

export const ConversationController: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOrganization);

  fastify.get('/api/v1/conversations', async (request, reply) => {
    const { organizationId } = request as any;

    const conversations = await prisma.conversation.findMany({
      where: { organizationId },
      orderBy: { lastActivity: 'desc' },
      include: { visitor: true },
    });
    return reply.send({ success: true, data: conversations });
  });

  fastify.get('/api/v1/conversations/:id', async (request, reply) => {
    const { organizationId } = request as any;
    const { id } = request.params as { id: string };

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } }, visitor: true },
    });

    if (!conversation || conversation.organizationId !== organizationId) {
      return reply.status(404).send({ success: false, error: 'Conversation not found' });
    }

    return reply.send({ success: true, data: conversation });
  });
};

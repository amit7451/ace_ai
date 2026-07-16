import { FastifyPluginAsync } from 'fastify';
import { conversationService } from '@ion-ai/chat';

export const ConversationController: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOrganization);

  fastify.get('/', async (request, reply) => {
    const organizationId = request.organization!.id;
    const conversations = await conversationService.getConversationsByOrganization(organizationId);
    return reply.send({ success: true, data: conversations });
  });

  fastify.get('/:id', async (request, reply) => {
    const organizationId = request.organization!.id;
    const { id } = request.params as { id: string };

    const conversation = await conversationService.getConversationWithVisitor(id);

    if (!conversation || conversation.organizationId !== organizationId) {
      return reply.status(404).send({ success: false, error: 'Conversation not found' });
    }

    return reply.send({ success: true, data: conversation });
  });
};

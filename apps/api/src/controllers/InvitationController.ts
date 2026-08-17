import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { memberService } from '../di';

export async function invitationController(fastify: FastifyInstance) {
  // Public endpoint: Fetch invitation details for review before accepting
  fastify.get('/:token', async (request: FastifyRequest, reply: FastifyReply) => {
    const { token } = request.params as { token: string };
    const result = await memberService.getInvitationDetails(token);
    return result;
  });

  // Authenticated endpoint: Accept invitation
  fastify.post(
    '/:token/accept',
    { preValidation: [fastify.authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { token } = request.params as { token: string };
      const userId = request.user.sub;
      const userEmail = request.user.email;

      const result = await memberService.acceptInvitation(token, userId, userEmail);
      return result;
    }
  );
}

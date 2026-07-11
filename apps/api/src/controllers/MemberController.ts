import { FastifyInstance, FastifyRequest } from 'fastify';
import { memberService } from '../di';
import { Role } from '@ion-ai/auth';
import { z } from 'zod';

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Role),
});

export async function memberController(fastify: FastifyInstance) {
  fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOrganization);

  fastify.get('/', async (request: FastifyRequest) => {
    const members = await memberService.getMembers(request.organization!.id);
    return { success: true, data: members };
  });

  fastify.post('/invitations', async (request: FastifyRequest) => {
    const data = InviteMemberSchema.parse(request.body);
    const result = await memberService.inviteMember(
      request.organization!.id,
      request.user.sub,
      request.memberRole!, // Populated by requireOrganization
      data.email,
      data.role
    );
    return result;
  });
}

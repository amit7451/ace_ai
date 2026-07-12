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

  fastify.delete('/:userId', async (request: FastifyRequest, reply) => {
    const { userId } = request.params as { userId: string };
    const { memberRole, organization } = request;

    if (memberRole !== 'OWNER' && memberRole !== 'ADMIN') {
      return reply
        .status(403)
        .send({ success: false, error: 'Forbidden. Only OWNER or ADMIN can remove members.' });
    }

    if (userId === request.user.sub) {
      return reply.status(400).send({ success: false, error: 'Cannot remove yourself' });
    }

    const memberRepository = (await import('../di')).memberRepository;

    const existingMember = await memberRepository.findByUserAndOrganization(
      userId,
      organization!.id
    );
    if (!existingMember) {
      return reply
        .status(404)
        .send({ success: false, error: 'Member not found in this organization' });
    }

    if (existingMember.role === 'OWNER') {
      return reply.status(403).send({ success: false, error: 'Cannot remove an OWNER' });
    }

    const { prisma } = await import('@ion-ai/database');
    await prisma.organizationMember.delete({
      where: {
        organizationId_userId: {
          organizationId: organization!.id,
          userId,
        },
      },
    });

    return { success: true, message: 'Member removed successfully' };
  });
}

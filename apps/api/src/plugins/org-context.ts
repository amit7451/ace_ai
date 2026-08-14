import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { organizationRepository, memberRepository } from '../di';
import { Organization } from '@ion-ai/database';
import { Role } from '@ion-ai/auth';

declare module 'fastify' {
  interface FastifyInstance {
    requireOrganization: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    organization?: Organization;
    memberRole?: Role;
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.decorate('requireOrganization', async (request: FastifyRequest, reply: FastifyReply) => {
    // Look for org ID in params (/:orgId), headers (x-organization-id), or query string
    const paramOrgId = (request.params as any)?.orgId;
    const headerOrgId =
      typeof request.headers['x-organization-id'] === 'string'
        ? request.headers['x-organization-id']
        : undefined;
    const queryOrgId = (request.query as any)?.orgId;

    if (paramOrgId && headerOrgId && paramOrgId !== headerOrgId) {
      throw Object.assign(
        new Error('Organization ID in URL path does not match x-organization-id header'),
        { statusCode: 400 }
      );
    }

    const orgId = paramOrgId || headerOrgId || queryOrgId;

    if (!orgId || typeof orgId !== 'string') {
      throw Object.assign(new Error('Organization context required'), { statusCode: 400 });
    }

    const org = await organizationRepository.findById(orgId);
    if (!org) {
      throw Object.assign(new Error('Organization not found'), { statusCode: 404 });
    }

    const member = await memberRepository.findByUserAndOrganization(request.user.sub, orgId);
    if (!member || member.status !== 'ACTIVE') {
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    }

    request.organization = org;
    request.memberRole = member.role as Role;
  });
});

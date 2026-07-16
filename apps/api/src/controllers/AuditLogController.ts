import { FastifyInstance, FastifyRequest } from 'fastify';
import { auditLogRepository } from '../di';

export async function auditLogController(fastify: FastifyInstance) {
  fastify.addHook('preValidation', fastify.authenticate);

  fastify.register(async (orgRoutes) => {
    orgRoutes.addHook('preHandler', orgRoutes.requireOrganization);

    orgRoutes.get('/', async (request: FastifyRequest) => {
      // @ts-ignore
      const orgId = request.organization.id;
      const logs = await auditLogRepository.findByOrganizationId(orgId);
      return { success: true, data: logs };
    });
  });
}

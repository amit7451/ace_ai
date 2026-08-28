import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { organizationService } from '../di';
import { CreateOrganizationRequestSchema } from '@ion-ai/contracts';

export async function organizationController(fastify: FastifyInstance) {
  // All routes here require authentication
  fastify.addHook('preValidation', fastify.authenticate);

  fastify.get('/', async (request: FastifyRequest) => {
    const organizations = await organizationService.getMyOrganizations(request.user.sub);
    return { success: true, data: organizations };
  });

  fastify.post('/', async (request: FastifyRequest) => {
    const data = CreateOrganizationRequestSchema.parse(request.body);
    const org = await organizationService.createOrganization(request.user.sub, data);
    return { success: true, data: org };
  });

  // The following routes require an organization context
  fastify.register(async (orgRoutes) => {
    orgRoutes.addHook('preHandler', orgRoutes.requireOrganization);

    orgRoutes.get('/:orgId', async (request: FastifyRequest) => {
      return { success: true, data: request.organization };
    });

    orgRoutes.get('/:orgId/summary', async (request: FastifyRequest) => {
      const orgId = (request.params as any).orgId || request.organization?.id;
      const summary = await organizationService.getOrganizationSummary(orgId, request.user.sub);
      return { success: true, data: summary };
    });

    orgRoutes.delete('/:orgId', async (request: FastifyRequest) => {
      const orgId = (request.params as any).orgId || request.organization?.id;
      const body = (request.body as { confirmationName?: string }) || {};
      const query = (request.query as { confirmationName?: string }) || {};
      const confirmationName = body.confirmationName || query.confirmationName;
      await organizationService.deleteOrganization(request.user.sub, orgId, confirmationName);

      return {
        success: true,
        message: 'Organization deleted successfully.',
      };
    });
  });
}

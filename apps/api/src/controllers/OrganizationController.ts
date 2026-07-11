import { FastifyInstance, FastifyRequest } from 'fastify';
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

    orgRoutes.get('/:id', async (request: FastifyRequest) => {
      // request.organization is populated by requireOrganization hook
      return { success: true, data: request.organization };
    });
  });
}

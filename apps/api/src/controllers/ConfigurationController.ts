import { FastifyInstance, FastifyRequest } from 'fastify';
import { configurationService } from '../di';
import { UpdateOrganizationConfigurationSchema } from '@ion-ai/contracts';

export async function configurationController(fastify: FastifyInstance) {
  fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOrganization);

  fastify.get('/', async (request: FastifyRequest) => {
    const config = await configurationService.getConfiguration(request.organization!.id);
    return { success: true, data: config };
  });

  fastify.patch('/', async (request: FastifyRequest) => {
    const data = UpdateOrganizationConfigurationSchema.parse(request.body);
    const config = await configurationService.updateConfiguration(
      request.organization!.id,
      request.user.sub,
      request.memberRole!,
      data
    );
    return { success: true, data: config };
  });
}

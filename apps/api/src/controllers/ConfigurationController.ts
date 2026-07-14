import { FastifyInstance, FastifyRequest } from 'fastify';
import { configurationService } from '../di';
import { UpdateOrganizationConfigurationSchema, SaveApiKeyRequestSchema } from '@ion-ai/contracts';

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

  fastify.get('/apikeys', async (request: FastifyRequest) => {
    const keys = await configurationService.getApiKeys(request.organization!.id);
    return { success: true, data: keys };
  });

  fastify.put('/apikeys', async (request: FastifyRequest) => {
    const data = SaveApiKeyRequestSchema.parse(request.body);
    await configurationService.saveApiKey(
      request.organization!.id,
      request.user.sub,
      request.memberRole!,
      data.provider,
      data.apiKey
    );
    return { success: true };
  });

  fastify.delete('/apikeys', async (request: FastifyRequest) => {
    const { provider } = request.query as { provider?: string };
    if (!provider) {
      return { success: false, error: { message: 'Provider is required' } };
    }
    await configurationService.deleteApiKey(
      request.organization!.id,
      request.user.sub,
      request.memberRole!,
      provider
    );
    return { success: true };
  });
}

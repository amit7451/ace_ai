import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@ion-ai/database';
import { widgetService, deploymentService } from '@ion-ai/chat';
import { z } from 'zod';

export const WidgetController: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preValidation', fastify.authenticate);
  fastify.addHook('preHandler', fastify.requireOrganization);

  fastify.post('/', async (request, reply) => {
    const organizationId = request.organization!.id;
    const schema = z.object({
      allowedDomains: z.array(z.string()).optional(),
    });

    const parsed = schema.safeParse(request.body || {});
    if (!parsed.success) return reply.status(400).send({ success: false, error: parsed.error });

    let deployment = await deploymentService.getDeploymentForOrganization(organizationId);
    if (!deployment) {
      deployment = await deploymentService.createDeployment(organizationId, 'Default Deployment');
    }

    const widget = await widgetService.generateWidget(
      deployment.id,
      parsed.data.allowedDomains || []
    );
    return reply.send({ success: true, data: widget });
  });

  fastify.get('/', async (request, reply) => {
    const organizationId = request.organization!.id;

    const deployment = await deploymentService.getDeploymentForOrganization(organizationId);
    if (!deployment) return reply.send({ success: true, data: [] });

    const widgets = await prisma.widget.findMany({ where: { deploymentId: deployment.id } });
    return reply.send({ success: true, data: widgets });
  });
};

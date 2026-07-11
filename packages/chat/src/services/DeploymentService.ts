import { prisma } from '@ion-ai/database';
import { Deployment } from '@prisma/client';

export class DeploymentService {
  async createDeployment(organizationId: string, name: string, environment = 'production') {
    return await prisma.deployment.create({
      data: {
        organizationId,
        name,
        environment,
      },
    });
  }

  async getDeploymentForOrganization(organizationId: string) {
    return await prisma.deployment.findFirst({
      where: { organizationId, environment: 'production' },
    });
  }
}

export const deploymentService = new DeploymentService();

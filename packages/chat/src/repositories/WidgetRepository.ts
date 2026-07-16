import { prisma, Prisma } from '@ion-ai/database';

export class WidgetRepository {
  async create(data: Prisma.WidgetUncheckedCreateInput) {
    return prisma.widget.create({ data });
  }

  async findByPublicKeyWithDetails(publicKey: string) {
    return prisma.widget.findUnique({
      where: { publicKey },
      include: { deployment: { include: { organization: true } } },
    });
  }

  async findManyByDeploymentId(deploymentId: string) {
    return prisma.widget.findMany({
      where: { deploymentId },
    });
  }
}

export const widgetRepository = new WidgetRepository();

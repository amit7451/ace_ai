import { prisma, IngestionJob, Prisma } from '@ion-ai/database';

export class JobRepository {
  async findByIdWithSource(id: string) {
    return prisma.ingestionJob.findUnique({
      where: { id },
      include: {
        knowledgeSource: {
          include: { document: true },
        },
      },
    });
  }

  async findManyByOrganizationId(organizationId: string) {
    return prisma.ingestionJob.findMany({
      where: { knowledgeSource: { organizationId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createIngestionJob(data: Prisma.IngestionJobUncheckedCreateInput) {
    return prisma.ingestionJob.create({ data });
  }

  async updateIngestionJob(id: string, data: Prisma.IngestionJobUncheckedUpdateInput) {
    return prisma.ingestionJob.update({
      where: { id },
      data,
    });
  }

  async deleteFailedJobsByOrganizationId(organizationId: string) {
    return prisma.ingestionJob.deleteMany({
      where: {
        status: 'FAILED',
        knowledgeSource: { organizationId },
      },
    });
  }

  async deleteByIdAndOrganizationId(id: string, organizationId: string) {
    return prisma.ingestionJob.deleteMany({
      where: { id, knowledgeSource: { organizationId } },
    });
  }
}

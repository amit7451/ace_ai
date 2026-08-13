import { prisma, KnowledgeSource, Document, IngestionJob, Prisma } from '@ion-ai/database';

export class KnowledgeRepository {
  async findByIdWithDetails(id: string) {
    return prisma.knowledgeSource.findUnique({
      where: { id },
      include: {
        document: true,
        ingestionJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findDuplicateDocument(hashSha256: string, organizationId: string) {
    return prisma.document.findFirst({
      where: {
        hashSha256,
        knowledgeSource: {
          organizationId,
        },
      },
    });
  }

  async findManyByOrganizationId(organizationId: string) {
    return prisma.knowledgeSource.findMany({
      where: { organizationId },
      include: { document: true, ingestionJobs: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTotalStorageUsage(organizationId: string): Promise<number> {
    const aggregate = await prisma.document.aggregate({
      _sum: {
        sizeBytes: true,
      },
      where: {
        knowledgeSource: {
          organizationId,
        },
      },
    });
    return aggregate._sum.sizeBytes || 0;
  }

  async createKnowledgeSource(data: Prisma.KnowledgeSourceUncheckedCreateInput) {
    return prisma.knowledgeSource.create({ data });
  }

  async createDocument(data: Prisma.DocumentUncheckedCreateInput) {
    return prisma.document.create({ data });
  }

  async updateKnowledgeSourceStatus(
    id: string,
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  ) {
    return prisma.knowledgeSource.update({
      where: { id },
      data: { status },
    });
  }
}

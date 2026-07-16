import { prisma, CrawlJob, Prisma } from '@ion-ai/database';

export class CrawlerRepository {
  async findById(id: string) {
    return prisma.crawlJob.findUnique({
      where: { id },
    });
  }

  async findManyByOrganizationId(organizationId: string) {
    return prisma.crawlJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: Prisma.CrawlJobUncheckedCreateInput) {
    return prisma.crawlJob.create({ data });
  }

  async updateStatus(id: string, data: Prisma.CrawlJobUncheckedUpdateInput) {
    return prisma.crawlJob.update({
      where: { id },
      data,
    });
  }
}

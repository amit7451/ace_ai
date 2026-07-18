import { prisma, Prisma } from '@ion-ai/database';

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

  /** Single crawl job with its per-page results, most recently discovered first. */
  async findByIdWithPages(id: string) {
    return prisma.crawlJob.findUnique({
      where: { id },
      include: {
        pages: {
          orderBy: { discoveredAt: 'desc' },
        },
      },
    });
  }

  /**
   * Used at creation time to avoid letting the same org queue two
   * concurrent crawls of the same URL (easy to do by double-clicking
   * "Add Crawler", and wasteful/confusing to run in parallel).
   */
  async findActiveByUrl(organizationId: string, url: string) {
    return prisma.crawlJob.findFirst({
      where: {
        organizationId,
        url,
        status: { in: ['PENDING', 'RUNNING'] },
      },
    });
  }

  /** Completed page URLs for a job — used by the pipeline to skip re-embedding on retry. */
  async findCompletedPageUrls(crawlJobId: string): Promise<string[]> {
    const pages = await prisma.crawledPage.findMany({
      where: { crawlJobId, status: 'COMPLETED' },
      select: { url: true },
    });
    return pages.map((p) => p.url);
  }

  async deleteById(id: string) {
    // CrawledPage rows cascade-delete with the job (schema onDelete: Cascade);
    // the KnowledgeSource/Document/Chunk rows a completed page produced do
    // NOT — CrawledPage.knowledgeSourceId is onDelete: SetNull, so deleting a
    // crawl's history never deletes knowledge that's already in production
    // use by the chatbot. Removing that knowledge is a separate, explicit
    // action on the Knowledge page.
    return prisma.crawlJob.delete({ where: { id } });
  }
}

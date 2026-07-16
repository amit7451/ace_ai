import { IQueueProvider, QueueName, JobName } from '@ion-ai/queue';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { CrawlerRepository } from '../repositories/CrawlerRepository';

export class CrawlerService {
  constructor(
    private crawlerRepo: CrawlerRepository,
    private queueProvider: IQueueProvider,
    private auditLogRepo: AuditLogRepository
  ) {}

  async getCrawlers(organizationId: string) {
    return this.crawlerRepo.findManyByOrganizationId(organizationId);
  }

  async retryCrawler(organizationId: string, crawlerId: string, userId: string) {
    const crawler = await this.crawlerRepo.findById(crawlerId);

    if (!crawler || crawler.organizationId !== organizationId) {
      throw Object.assign(new Error('Crawler job not found'), { statusCode: 404 });
    }

    if (crawler.status !== 'FAILED') {
      throw Object.assign(new Error('Only failed crawlers can be retried'), { statusCode: 400 });
    }

    await this.queueProvider.addJob(QueueName.CRAWLER, JobName.CRAWL, {
      organizationId,
      crawlJobId: crawler.id,
      url: crawler.url,
    });

    await this.crawlerRepo.updateStatus(crawlerId, {
      status: 'PENDING',
      errorDetails: null,
      pagesCrawled: 0,
    });

    await this.auditLogRepo.create({
      organizationId,
      action: 'CRAWL_RETRIED',
      actorId: userId,
      metadata: { crawlJobId: crawler.id, url: crawler.url },
    });

    return { success: true };
  }
}

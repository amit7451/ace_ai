import { IQueueProvider, QueueName, JobName } from '@ion-ai/queue';
import { Role, hasPermission } from '@ion-ai/auth';
import { assertValidSeedUrl, SsrfBlockedError } from '@ion-ai/crawler';
import { CreateCrawlJobRequest } from '@ion-ai/contracts';
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

  async getCrawler(organizationId: string, crawlerId: string) {
    const crawler = await this.crawlerRepo.findByIdWithPages(crawlerId);
    if (!crawler || crawler.organizationId !== organizationId) {
      throw Object.assign(new Error('Crawler job not found'), { statusCode: 404 });
    }
    return crawler;
  }

  async createCrawlJob(
    organizationId: string,
    actorId: string,
    actorRole: Role,
    input: CreateCrawlJobRequest
  ) {
    if (!hasPermission(actorRole, Role.EDITOR)) {
      throw Object.assign(new Error('Insufficient permissions to add a crawler.'), {
        statusCode: 403,
      });
    }

    // Fail fast with a clear error at creation time rather than silently
    // queuing a job that will only fail once a worker picks it up. This is
    // a structural pre-check (protocol, credentials-in-URL, obviously
    // private IP literals) — the actual DNS-resolution-time SSRF check
    // (which is the one that really matters; see @ion-ai/crawler's
    // ssrf-guard) runs again on every request the crawl makes, since a
    // hostname can resolve differently by the time the job runs.
    try {
      assertValidSeedUrl(input.url);
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        throw Object.assign(new Error(err.message), { statusCode: 400 });
      }
      throw err;
    }

    const existingActive = await this.crawlerRepo.findActiveByUrl(organizationId, input.url);
    if (existingActive) {
      throw Object.assign(
        new Error('A crawl of this URL is already pending or running for your organization.'),
        { statusCode: 409 }
      );
    }

    const crawlJob = await this.crawlerRepo.create({
      organizationId,
      url: input.url,
      status: 'PENDING',
      maxPages: input.maxPages ?? 50,
      maxDepth: input.maxDepth ?? 3,
      includePaths: input.includePaths ?? [],
      excludePaths: input.excludePaths ?? [],
      respectRobotsTxt: input.respectRobotsTxt ?? true,
      sameOriginOnly: input.sameOriginOnly ?? true,
    });

    await this.queueProvider.addJob(QueueName.CRAWLER, JobName.CRAWL, {
      organizationId,
      crawlJobId: crawlJob.id,
      url: crawlJob.url,
    });

    await this.auditLogRepo.create({
      organizationId,
      action: 'CRAWL_CREATED',
      actorId,
      metadata: { crawlJobId: crawlJob.id, url: crawlJob.url },
    });

    return crawlJob;
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

    // Pages already marked COMPLETED from the previous attempt are left
    // alone on purpose — the worker's pipeline treats them as "already
    // ingested" and skips re-embedding them, so a retry after a late-crawl
    // failure resumes rather than redoing everything from scratch. These
    // counters self-correct back to the true totals within moments of the
    // crawl resuming (see CrawlerPipeline.bumpCounts).
    await this.crawlerRepo.updateStatus(crawlerId, {
      status: 'PENDING',
      errorDetails: null,
      pagesCrawled: 0,
      pagesFailed: 0,
      pagesDiscovered: 0,
      finishedAt: null,
    });

    await this.auditLogRepo.create({
      organizationId,
      action: 'CRAWL_RETRIED',
      actorId: userId,
      metadata: { crawlJobId: crawler.id, url: crawler.url },
    });

    return { success: true };
  }

  async cancelCrawler(organizationId: string, crawlerId: string, actorId: string) {
    const crawler = await this.crawlerRepo.findById(crawlerId);
    if (!crawler || crawler.organizationId !== organizationId) {
      throw Object.assign(new Error('Crawler job not found'), { statusCode: 404 });
    }
    if (crawler.status !== 'PENDING' && crawler.status !== 'RUNNING') {
      throw Object.assign(new Error('Only a pending or running crawl can be cancelled.'), {
        statusCode: 400,
      });
    }

    // Cooperative cancellation: the worker polls CrawlJob.status roughly
    // every 2s and stops between pages once it sees CANCELLED — there's no
    // hard kill of an in-flight page fetch, so cancellation takes effect
    // within a couple of seconds rather than instantly.
    await this.crawlerRepo.updateStatus(crawlerId, { status: 'CANCELLED', finishedAt: new Date() });

    await this.auditLogRepo.create({
      organizationId,
      action: 'CRAWL_CANCELLED',
      actorId,
      metadata: { crawlJobId: crawler.id, url: crawler.url },
    });

    return { success: true };
  }

  async deleteCrawler(organizationId: string, crawlerId: string, actorRole: Role, actorId: string) {
    if (!hasPermission(actorRole, Role.EDITOR)) {
      throw Object.assign(new Error('Insufficient permissions to delete a crawler.'), {
        statusCode: 403,
      });
    }

    const crawler = await this.crawlerRepo.findById(crawlerId);
    if (!crawler || crawler.organizationId !== organizationId) {
      throw Object.assign(new Error('Crawler job not found'), { statusCode: 404 });
    }
    if (crawler.status === 'RUNNING') {
      throw Object.assign(new Error('Cancel this crawl before deleting it.'), { statusCode: 400 });
    }

    await this.crawlerRepo.deleteById(crawlerId);

    await this.auditLogRepo.create({
      organizationId,
      action: 'CRAWL_DELETED',
      actorId,
      metadata: { crawlJobId: crawler.id, url: crawler.url },
    });

    return { success: true };
  }
}

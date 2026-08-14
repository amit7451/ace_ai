import { IQueueProvider, QueueName, JobName } from '@ion-ai/queue';
import { Role, hasPermission } from '@ion-ai/auth';
import { JobRepository } from '../repositories/JobRepository';
import { KnowledgeRepository } from '../repositories/KnowledgeRepository';

export class JobService {
  constructor(
    private jobRepo: JobRepository,
    private knowledgeRepo: KnowledgeRepository,
    private queueProvider: IQueueProvider
  ) {}

  async getJobs(organizationId: string) {
    const isPaused = await this.queueProvider.isPaused(QueueName.INGESTION);
    const jobs = await this.jobRepo.findManyByOrganizationId(organizationId);
    return { jobs, isPaused };
  }

  async retryJob(organizationId: string, jobId: string) {
    const job = await this.jobRepo.findByIdWithSource(jobId);

    if (!job || job.knowledgeSource.organizationId !== organizationId) {
      throw Object.assign(new Error('Job not found'), { statusCode: 404 });
    }

    if (job.status !== 'FAILED') {
      throw Object.assign(new Error('Only failed jobs can be retried'), { statusCode: 400 });
    }

    if (!job.knowledgeSource.document) {
      throw Object.assign(new Error('No associated document found'), { statusCode: 400 });
    }

    // Clear any previous failed job instance from BullMQ before re-queuing
    await this.queueProvider.removeJob(QueueName.INGESTION, jobId);

    await this.queueProvider.addJob(
      QueueName.INGESTION,
      JobName.UPLOAD,
      {
        organizationId,
        knowledgeSourceId: job.knowledgeSourceId,
        documentId: job.knowledgeSource.document.id,
        storageKey: job.knowledgeSource.document.storageKey,
        mimeType: job.knowledgeSource.document.mimeType,
      },
      { jobId }
    );

    await this.jobRepo.updateIngestionJob(jobId, {
      status: 'PENDING',
      currentStage: 'UPLOADED',
      progress: 0,
      retryCount: { increment: 1 },
      failureReason: null,
    });

    await this.knowledgeRepo.updateKnowledgeSourceStatus(job.knowledgeSourceId, 'PENDING');

    return { success: true };
  }

  async pauseJobs(actorRole: Role) {
    if (!hasPermission(actorRole, Role.ADMIN)) {
      throw Object.assign(new Error('Admin access required to pause ingestion'), {
        statusCode: 403,
      });
    }
    await this.queueProvider.pause(QueueName.INGESTION);
    return { success: true };
  }

  async resumeJobs(actorRole: Role) {
    if (!hasPermission(actorRole, Role.ADMIN)) {
      throw Object.assign(new Error('Admin access required to resume ingestion'), {
        statusCode: 403,
      });
    }
    await this.queueProvider.resume(QueueName.INGESTION);
    return { success: true };
  }

  async clearFailedJobs(organizationId: string, actorRole: Role) {
    if (!hasPermission(actorRole, Role.ADMIN)) {
      throw Object.assign(new Error('Admin access required to clear failed jobs'), {
        statusCode: 403,
      });
    }
    // Clean failed BullMQ jobs filtered specifically for this tenant
    await this.queueProvider.cleanFailed(QueueName.INGESTION, organizationId);
    await this.jobRepo.deleteFailedJobsByOrganizationId(organizationId);
    return { success: true };
  }

  async deleteJob(organizationId: string, jobId: string) {
    await this.queueProvider.removeJob(QueueName.INGESTION, jobId);
    await this.jobRepo.deleteByIdAndOrganizationId(jobId, organizationId);
    return { success: true };
  }
}

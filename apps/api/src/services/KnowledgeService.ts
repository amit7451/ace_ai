import { IStorageProvider } from '@ion-ai/storage';
import { IQueueProvider, QueueName, JobName, UploadJobPayload } from '@ion-ai/queue';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { KnowledgeRepository } from '../repositories/KnowledgeRepository';
import { JobRepository } from '../repositories/JobRepository';

export class KnowledgeService {
  constructor(
    private storageProvider: IStorageProvider,
    private queueProvider: IQueueProvider,
    private auditLogRepo: AuditLogRepository,
    private knowledgeRepo: KnowledgeRepository,
    private jobRepo: JobRepository
  ) {}

  async processUpload(
    organizationId: string,
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
    originalName: string
  ) {
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const existingDoc = await this.knowledgeRepo.findDuplicateDocument(hash, organizationId);
    if (existingDoc) {
      throw Object.assign(new Error('DuplicateDocument'), { statusCode: 409 });
    }

    const storageKey = `${organizationId}/${uuidv4()}-${originalName}`;
    await this.storageProvider.upload(storageKey, fileBuffer, mimeType);

    const knowledgeSource = await this.knowledgeRepo.createKnowledgeSource({
      organizationId,
      sourceType: this.mapMimeToSourceType(mimeType),
      createdBy: userId,
      status: 'PENDING',
    });

    const document = await this.knowledgeRepo.createDocument({
      knowledgeSourceId: knowledgeSource.id,
      storageKey,
      mimeType,
      sizeBytes: fileBuffer.length,
      hashSha256: hash,
    });

    const ingestionJob = await this.jobRepo.createIngestionJob({
      knowledgeSourceId: knowledgeSource.id,
      currentStage: 'UPLOADED',
      progress: 0,
      status: 'PENDING',
    });

    const payload: UploadJobPayload = {
      organizationId,
      knowledgeSourceId: knowledgeSource.id,
      documentId: document.id,
      storageKey,
      mimeType,
    };

    await this.queueProvider.addJob(QueueName.INGESTION, JobName.UPLOAD, payload);

    await this.auditLogRepo.create({
      organizationId,
      action: 'KNOWLEDGE_UPLOADED',
      actorId: userId,
      metadata: { originalName, mimeType, documentId: document.id },
    });

    return {
      knowledgeSourceId: knowledgeSource.id,
      jobId: ingestionJob.id,
    };
  }

  async getKnowledgeSources(organizationId: string) {
    return this.knowledgeRepo.findManyByOrganizationId(organizationId);
  }

  async deleteKnowledgeSource(organizationId: string, sourceId: string, userId: string) {
    const source = await this.knowledgeRepo.findByIdWithDetails(sourceId);

    if (!source || source.organizationId !== organizationId) {
      throw Object.assign(new Error('NotFound'), { statusCode: 404 });
    }

    if (source.document) {
      await this.queueProvider.addJob(QueueName.INGESTION, JobName.DELETE, {
        organizationId,
        knowledgeSourceId: source.id,
        documentId: source.document.id,
        storageKey: source.document.storageKey,
      });
    }

    await this.knowledgeRepo.updateKnowledgeSourceStatus(sourceId, 'PENDING');

    await this.auditLogRepo.create({
      organizationId,
      action: 'KNOWLEDGE_DELETED',
      actorId: userId,
      metadata: { sourceId },
    });

    return { success: true };
  }

  async retryKnowledgeSource(organizationId: string, sourceId: string) {
    const source = await this.knowledgeRepo.findByIdWithDetails(sourceId);

    if (!source || source.organizationId !== organizationId) {
      throw Object.assign(new Error('Knowledge source not found'), { statusCode: 404 });
    }

    if (source.status !== 'FAILED') {
      throw Object.assign(new Error('Only failed sources can be retried'), { statusCode: 400 });
    }

    const latestJob = source.ingestionJobs[0];
    if (!latestJob || latestJob.status !== 'FAILED') {
      throw Object.assign(new Error('No failed ingestion job found'), { statusCode: 400 });
    }

    if (!source.document) {
      throw Object.assign(new Error('No associated document found'), { statusCode: 400 });
    }

    await this.queueProvider.addJob(QueueName.INGESTION, JobName.UPLOAD, {
      organizationId,
      knowledgeSourceId: source.id,
      documentId: source.document.id,
      storageKey: source.document.storageKey,
      mimeType: source.document.mimeType,
    });

    await this.jobRepo.updateIngestionJob(latestJob.id, {
      status: 'PENDING',
      currentStage: 'UPLOADED',
      progress: 0,
      retryCount: { increment: 1 },
      failureReason: null,
    });

    await this.knowledgeRepo.updateKnowledgeSourceStatus(sourceId, 'PENDING');

    return { success: true };
  }

  private mapMimeToSourceType(mime: string) {
    if (mime === 'application/pdf') return 'PDF';
    if (mime.includes('wordprocessingml')) return 'DOCX';
    if (mime === 'text/plain') return 'TXT';
    if (mime === 'text/markdown' || mime === 'text/md') return 'MARKDOWN';
    return 'TXT';
  }
}

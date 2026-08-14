import { IStorageProvider } from '@ion-ai/storage';
import { IQueueProvider, QueueName, JobName, UploadJobPayload } from '@ion-ai/queue';
import { prisma } from '@ion-ai/database';
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
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    const MAX_ORG_QUOTA = 20 * 1024 * 1024; // 20 MB

    // 1. Strict backend file size validation (5 MB limit)
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw Object.assign(new Error('File size exceeds maximum limit of 5 MB per document.'), {
        statusCode: 400,
      });
    }

    // 2. Strict backend organization storage quota pre-validation
    const currentTotalUsage = await this.knowledgeRepo.getTotalStorageUsage(organizationId);
    if (currentTotalUsage + fileBuffer.length > MAX_ORG_QUOTA) {
      const currentMb = (currentTotalUsage / (1024 * 1024)).toFixed(2);
      throw Object.assign(
        new Error(
          `Organization storage quota exceeded. Current usage: ${currentMb} MB / Max limit: 20.00 MB.`
        ),
        { statusCode: 400 }
      );
    }

    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const existingDoc = await this.knowledgeRepo.findDuplicateDocument(hash, organizationId);
    if (existingDoc) {
      throw Object.assign(new Error('DuplicateDocument'), { statusCode: 409 });
    }

    const storageKey = `${organizationId}/${uuidv4()}-${originalName}`;
    await this.storageProvider.upload(storageKey, fileBuffer, mimeType);

    try {
      // 3. Atomically re-validate quota and create records in a database transaction
      const { knowledgeSource, document, ingestionJob } = await prisma.$transaction(async (tx) => {
        const aggregate = await tx.document.aggregate({
          _sum: { sizeBytes: true },
          where: { knowledgeSource: { organizationId } },
        });
        const liveUsage = aggregate._sum.sizeBytes || 0;

        if (liveUsage + fileBuffer.length > MAX_ORG_QUOTA) {
          const currentMb = (liveUsage / (1024 * 1024)).toFixed(2);
          throw Object.assign(
            new Error(
              `Organization storage quota exceeded. Current usage: ${currentMb} MB / Max limit: 20.00 MB.`
            ),
            { statusCode: 400 }
          );
        }

        const ks = await tx.knowledgeSource.create({
          data: {
            organizationId,
            sourceType: this.mapMimeToSourceType(mimeType),
            createdBy: userId,
            status: 'PENDING',
          },
        });

        const doc = await tx.document.create({
          data: {
            knowledgeSourceId: ks.id,
            storageKey,
            mimeType,
            sizeBytes: fileBuffer.length,
            hashSha256: hash,
          },
        });

        const job = await tx.ingestionJob.create({
          data: {
            knowledgeSourceId: ks.id,
            currentStage: 'UPLOADED',
            progress: 0,
            status: 'PENDING',
          },
        });

        return { knowledgeSource: ks, document: doc, ingestionJob: job };
      });

      const payload: UploadJobPayload = {
        organizationId,
        knowledgeSourceId: knowledgeSource.id,
        documentId: document.id,
        storageKey,
        mimeType,
      };

      await this.queueProvider.addJob(QueueName.INGESTION, JobName.UPLOAD, payload, {
        jobId: ingestionJob.id,
      });

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
    } catch (err) {
      // Rollback uploaded file in storage if transaction or queue insertion fails
      await this.storageProvider.delete(storageKey).catch(() => {});
      throw err;
    }
  }

  async getKnowledgeSources(organizationId: string) {
    return this.knowledgeRepo.findManyByOrganizationId(organizationId);
  }

  async getSignedDocumentUrl(
    sourceId: string,
    requestOrgId?: string,
    expiresIn: number = 3600
  ): Promise<{ signedUrl: string; filename: string; mimeType: string }> {
    const source = await this.knowledgeRepo.findByIdWithDetails(sourceId);

    if (!source || !source.document) {
      throw Object.assign(new Error('Document not found'), { statusCode: 404 });
    }

    if (requestOrgId && source.organizationId !== requestOrgId) {
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    }

    const signedUrl = await this.storageProvider.getSignedUrl(
      source.document.storageKey,
      expiresIn
    );
    const cleanFilename = this.extractCleanFilename(source.document.storageKey);

    return {
      signedUrl,
      filename: cleanFilename,
      mimeType: source.document.mimeType || 'application/pdf',
    };
  }

  async getDocumentFile(sourceId: string, requestOrgId?: string) {
    const source = await this.knowledgeRepo.findByIdWithDetails(sourceId);

    if (!source || !source.document) {
      throw Object.assign(new Error('Document not found'), { statusCode: 404 });
    }

    if (requestOrgId && source.organizationId !== requestOrgId) {
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    }

    const buffer = await this.storageProvider.download(source.document.storageKey);
    const cleanFilename = this.extractCleanFilename(source.document.storageKey);

    return {
      buffer,
      mimeType: source.document.mimeType || 'application/pdf',
      filename: cleanFilename,
    };
  }

  extractCleanFilename(storageKey: string): string {
    if (!storageKey) return 'document';
    const base = storageKey.includes('/') ? storageKey.split('/')[1] : storageKey;
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-/;
    return base.replace(uuidRegex, '');
  }

  async deleteKnowledgeSource(organizationId: string, sourceId: string, userId: string) {
    const source = await this.knowledgeRepo.findByIdWithDetails(sourceId);

    if (!source || source.organizationId !== organizationId) {
      throw Object.assign(new Error('NotFound'), { statusCode: 404 });
    }

    await this.queueProvider.addJob(QueueName.INGESTION, JobName.DELETE, {
      organizationId,
      knowledgeSourceId: source.id,
      documentId: source.document?.id ?? '',
      storageKey: source.document?.storageKey ?? '',
    });

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

    // Clear any previous failed job instance from BullMQ before re-queuing
    await this.queueProvider.removeJob(QueueName.INGESTION, latestJob.id);

    if (!source.document || latestJob.currentStage === 'DELETING') {
      await this.queueProvider.addJob(
        QueueName.INGESTION,
        JobName.DELETE,
        {
          organizationId,
          knowledgeSourceId: source.id,
          documentId: source.document?.id ?? '',
          storageKey: source.document?.storageKey ?? '',
        },
        { jobId: latestJob.id }
      );

      await this.jobRepo.updateIngestionJob(latestJob.id, {
        status: 'PENDING',
        currentStage: 'DELETING',
        progress: 0,
        retryCount: { increment: 1 },
        failureReason: null,
      });
    } else {
      await this.queueProvider.addJob(
        QueueName.INGESTION,
        JobName.UPLOAD,
        {
          organizationId,
          knowledgeSourceId: source.id,
          documentId: source.document.id,
          storageKey: source.document.storageKey,
          mimeType: source.document.mimeType,
        },
        { jobId: latestJob.id }
      );

      await this.jobRepo.updateIngestionJob(latestJob.id, {
        status: 'PENDING',
        currentStage: 'UPLOADED',
        progress: 0,
        retryCount: { increment: 1 },
        failureReason: null,
      });
    }

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

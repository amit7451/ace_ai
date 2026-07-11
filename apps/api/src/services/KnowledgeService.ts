import { prisma } from '@ion-ai/database';
import { IStorageProvider } from '@ion-ai/storage';
import { IQueueProvider, QueueName, JobName, UploadJobPayload } from '@ion-ai/queue';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export class KnowledgeService {
  constructor(
    private storageProvider: IStorageProvider,
    private queueProvider: IQueueProvider
  ) {}

  async processUpload(
    organizationId: string,
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
    originalName: string
  ) {
    // 1. Generate SHA-256 Hash for duplicate detection
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // 2. Check for duplicates in the same organization
    const existingDoc = await prisma.document.findFirst({
      where: {
        hashSha256: hash,
        knowledgeSource: {
          organizationId: organizationId,
        },
      },
    });

    if (existingDoc) {
      throw Object.assign(new Error('DuplicateDocument'), { statusCode: 409 });
    }

    // 3. Upload to Cloudflare R2 via storage provider
    const storageKey = `${organizationId}/${uuidv4()}-${originalName}`;
    await this.storageProvider.upload(storageKey, fileBuffer, mimeType);

    // 4. Create DB Records
    const knowledgeSource = await prisma.knowledgeSource.create({
      data: {
        organizationId,
        sourceType: this.mapMimeToSourceType(mimeType),
        createdBy: userId,
        status: 'PENDING',
      },
    });

    const document = await prisma.document.create({
      data: {
        knowledgeSourceId: knowledgeSource.id,
        storageKey,
        mimeType,
        sizeBytes: fileBuffer.length,
        hashSha256: hash,
      },
    });

    const ingestionJob = await prisma.ingestionJob.create({
      data: {
        knowledgeSourceId: knowledgeSource.id,
        currentStage: 'UPLOADED',
        progress: 0,
        status: 'PENDING',
      },
    });

    // 5. Enqueue Job to BullMQ for the Worker
    const payload: UploadJobPayload = {
      organizationId,
      knowledgeSourceId: knowledgeSource.id,
      documentId: document.id,
      storageKey,
      mimeType,
    };

    await this.queueProvider.addJob(QueueName.INGESTION, JobName.UPLOAD, payload);

    return {
      knowledgeSourceId: knowledgeSource.id,
      jobId: ingestionJob.id,
    };
  }

  async getKnowledgeSources(organizationId: string) {
    return prisma.knowledgeSource.findMany({
      where: { organizationId },
      include: { document: true, ingestionJobs: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteKnowledgeSource(organizationId: string, sourceId: string) {
    const source = await prisma.knowledgeSource.findUnique({
      where: { id: sourceId },
      include: { document: true },
    });

    if (!source || source.organizationId !== organizationId) {
      throw Object.assign(new Error('NotFound'), { statusCode: 404 });
    }

    // Instead of deleting immediately, we enqueue a delete job
    if (source.document) {
      await this.queueProvider.addJob(QueueName.INGESTION, JobName.DELETE, {
        organizationId,
        knowledgeSourceId: source.id,
        documentId: source.document.id,
        storageKey: source.document.storageKey,
      });
    }

    // Mark as pending deletion
    await prisma.knowledgeSource.update({
      where: { id: sourceId },
      data: { status: 'PENDING' }, // or a 'DELETING' status if added to schema
    });

    return { success: true };
  }

  private mapMimeToSourceType(mime: string) {
    if (mime === 'application/pdf') return 'PDF';
    if (mime.includes('wordprocessingml')) return 'DOCX';
    if (mime === 'text/plain') return 'TXT';
    if (mime === 'text/markdown' || mime === 'text/md') return 'MARKDOWN';
    return 'TXT'; // Default fallback
  }
}

import { prisma } from '@ion-ai/database';
import { resolveEmbeddingProvider } from '../lib/resolve-embedding-provider';
import { IStorageProvider } from '@ion-ai/storage';
import { ParserFactory } from '@ion-ai/parser';
import { logger } from '@ion-ai/logger';
import {
  KnowledgeProcessor,
  EmbeddingProviderFactory,
  VectorStoreProviderFactory,
} from '@ion-ai/ai-core';
import { UploadJobPayload } from '@ion-ai/queue';
import { env } from '@ion-ai/config';

export class IngestionPipeline {
  constructor(
    private storageProvider: IStorageProvider,
    private qdrantUrl: string
  ) {}

  async processUploadJob(job: UploadJobPayload, jobId: string, bullmqJob?: import('bullmq').Job) {
    logger.info(
      { documentId: job.documentId, organizationId: job.organizationId },
      'Starting ingestion job'
    );

    // Update job status
    await prisma.ingestionJob.updateMany({
      where: { knowledgeSourceId: job.knowledgeSourceId },
      data: { status: 'RUNNING', currentStage: 'DOWNLOADING' },
    });

    try {
      // 1. Download
      const buffer = await this.storageProvider.download(job.storageKey);

      // Update status
      await prisma.ingestionJob.updateMany({
        where: { knowledgeSourceId: job.knowledgeSourceId },
        data: { currentStage: 'PARSING', progress: 10 },
      });

      // 2. Parse
      const parser = ParserFactory.getParser(job.mimeType);
      const parsedDoc = await parser.parse(buffer);

      // Update status
      await prisma.ingestionJob.updateMany({
        where: { knowledgeSourceId: job.knowledgeSourceId },
        data: { currentStage: 'CHUNKING', progress: 30 },
      });

      // 3. Chunk (via ai-core)
      const processor = new KnowledgeProcessor();
      const chunks = processor.process(
        {
          content: parsedDoc.content,
          mimeType: job.mimeType,
          metadata: parsedDoc.metadata,
        },
        {
          tenantId: job.organizationId,
          assistantId: 'default',
          documentId: job.documentId,
        }
      );

      // Update status
      await prisma.ingestionJob.updateMany({
        where: { knowledgeSourceId: job.knowledgeSourceId },
        data: { currentStage: 'EMBEDDING', progress: 50 },
      });

      // 4. Embed (via ai-core)
      // We need organization config for embedding provider
      const { providerName, model, apiKey } = await resolveEmbeddingProvider(job.organizationId);

      const embedder = EmbeddingProviderFactory.create({
        provider: providerName as any,
        model,
        apiKey: apiKey ?? '',
      });

      const chunkTexts = chunks.map((c) => c.text);
      const embeddings = await embedder.embedBatch(chunkTexts);

      // Update status
      await prisma.ingestionJob.updateMany({
        where: { knowledgeSourceId: job.knowledgeSourceId },
        data: { currentStage: 'STORING', progress: 80 },
      });

      // 5. Store in Qdrant (via ai-core)
      // We isolate by organization ID using separate collections
      const collectionName = `org_${job.organizationId.replace(/-/g, '_')}`;
      const vectorStore = VectorStoreProviderFactory.create({
        provider: 'qdrant',
        url: this.qdrantUrl,
      });

      // Ensure collection exists
      await vectorStore.getOrCreateCollection({
        name: collectionName,
        vectorSize: embeddings.dimensions,
        distance: 'cosine',
      });

      const vectors = chunks.map((c, i) => {
        const { metadata, ...core } = c;
        const payload = metadata ? { ...core, ...metadata } : { ...core };

        return {
          id: c.chunkId,
          vector: embeddings.embeddings[i].embedding,
          payload: {
            ...payload,
            organizationId: job.organizationId,
            knowledgeSourceId: job.knowledgeSourceId,
          },
        };
      });

      await vectorStore.upsertBatch(collectionName, vectors);

      // 6. Store metadata in Postgres (clean existing chunks for documentId first to guarantee idempotency on retry)
      await prisma.chunk.deleteMany({
        where: { documentId: job.documentId },
      });

      for (const vector of vectors) {
        await prisma.chunk.create({
          data: {
            documentId: job.documentId,
            chunkIndex: vector.payload.chunkIndex as number,
            tokenCount: chunks[vector.payload.chunkIndex as number].tokenCount,
            vectorId: vector.id,
            metadata: ((vector.payload as any).metadata as any) ?? {},
          },
        });
      }

      // Update final status
      await prisma.ingestionJob.updateMany({
        where: { knowledgeSourceId: job.knowledgeSourceId },
        data: {
          currentStage: 'COMPLETED',
          progress: 100,
          status: 'COMPLETED',
          finishedAt: new Date(),
        },
      });
      await prisma.knowledgeSource.update({
        where: { id: job.knowledgeSourceId },
        data: { status: 'COMPLETED' },
      });

      logger.info({ documentId: job.documentId }, 'Ingestion completed successfully');
    } catch (error: any) {
      const maxAttempts = bullmqJob?.opts?.attempts ?? 3;
      const attemptsMade = (bullmqJob?.attemptsMade ?? 0) + 1;
      const isFinalAttempt = attemptsMade >= maxAttempts;

      const rawMsg = error?.message || String(error || 'Ingestion failed');
      let cleanMsg = rawMsg;
      try {
        if (typeof rawMsg === 'string' && rawMsg.includes('{') && rawMsg.includes('}')) {
          const start = rawMsg.indexOf('{');
          const end = rawMsg.lastIndexOf('}') + 1;
          const jsonStr = rawMsg.slice(start, end);
          const parsed = JSON.parse(jsonStr);
          cleanMsg = parsed.error?.message || parsed.message || parsed.error || rawMsg;
        }
      } catch (_) {}

      if (!isFinalAttempt) {
        logger.warn(
          { documentId: job.documentId, attemptsMade, maxAttempts, error: cleanMsg },
          'Ingestion job attempt failed; marking RETRYING for queue backoff'
        );
        await prisma.ingestionJob.updateMany({
          where: { knowledgeSourceId: job.knowledgeSourceId },
          data: {
            status: 'RETRYING',
            retryCount: attemptsMade,
            failureReason: `Attempt ${attemptsMade}/${maxAttempts} failed: ${cleanMsg}`,
          },
        });
        await prisma.knowledgeSource.update({
          where: { id: job.knowledgeSourceId },
          data: { status: 'RETRYING' },
        });
      } else {
        logger.error(
          { documentId: job.documentId, attemptsMade, maxAttempts, error: cleanMsg },
          'Ingestion job exhausted all retry attempts; marking FAILED'
        );
        await prisma.ingestionJob.updateMany({
          where: { knowledgeSourceId: job.knowledgeSourceId },
          data: {
            status: 'FAILED',
            retryCount: attemptsMade,
            failureReason: cleanMsg,
            finishedAt: new Date(),
          },
        });
        await prisma.knowledgeSource.update({
          where: { id: job.knowledgeSourceId },
          data: { status: 'FAILED' },
        });
      }
      throw error;
    }
  }

  async processDeleteJob(
    job: {
      organizationId: string;
      knowledgeSourceId: string;
      documentId: string;
      storageKey: string;
    },
    jobId: string
  ) {
    logger.info(
      { knowledgeSourceId: job.knowledgeSourceId, organizationId: job.organizationId },
      'Starting delete job'
    );
    try {
      // 1. Delete from R2 Storage
      if (job.storageKey) {
        try {
          logger.info({ storageKey: job.storageKey }, 'Deleting from R2 storage');
          await this.storageProvider.delete(job.storageKey);
          logger.info({ storageKey: job.storageKey }, 'Successfully deleted from R2');
        } catch (e: any) {
          logger.warn(
            { storageKey: job.storageKey, error: e.message },
            'R2 Deletion non-fatal error (continuing cleanup)'
          );
        }
      }

      // 2. Delete from Qdrant Vector Store
      try {
        const collectionName = `org_${job.organizationId.replace(/-/g, '_')}`;
        const vectorStore = VectorStoreProviderFactory.create({
          provider: 'qdrant',
          url: this.qdrantUrl,
        });

        const exists = await vectorStore.collectionExists(collectionName);
        if (exists) {
          // Use deleteByFilter on knowledgeSourceId to ensure all vectors in Qdrant are deleted,
          // even if Postgres chunks are missing (e.g., due to a crash between upserting to Qdrant
          // and inserting chunks to Postgres during ingestion).
          await vectorStore.deleteByFilter(collectionName, {
            must: [{ key: 'knowledgeSourceId', match: { value: job.knowledgeSourceId } }],
          });
          logger.info(
            { knowledgeSourceId: job.knowledgeSourceId },
            'Successfully deleted vectors from Qdrant'
          );
        } else {
          logger.info(
            { collectionName },
            'Qdrant collection does not exist. Skipping vector deletion'
          );
        }
      } catch (e: any) {
        // If collection does not exist (404/NOT_FOUND), deletion is already satisfied (idempotent)
        if (
          e.name === 'VectorStoreNotFoundError' ||
          e.code === 'NOT_FOUND' ||
          e.statusCode === 404 ||
          e.message?.includes('Not found') ||
          e.cause?.status?.error?.includes("doesn't exist")
        ) {
          logger.info(
            { knowledgeSourceId: job.knowledgeSourceId },
            'Qdrant collection or vectors not found. Skipping vector deletion'
          );
        } else {
          logger.warn(
            { knowledgeSourceId: job.knowledgeSourceId, error: e.message },
            'Qdrant Deletion error (continuing cleanup)'
          );
        }
      }

      // 3. Delete from Postgres
      // Due to cascade delete settings, deleting the KnowledgeSource might delete Document and Chunks automatically.
      // But let's safely delete them in order if cascade isn't set up.
      if (job.documentId) {
        await prisma.chunk.deleteMany({
          where: { documentId: job.documentId },
        });
        await prisma.document.deleteMany({
          where: { id: job.documentId },
        });
      }
      await prisma.ingestionJob.deleteMany({
        where: { knowledgeSourceId: job.knowledgeSourceId },
      });
      await prisma.knowledgeSource.deleteMany({
        where: { id: job.knowledgeSourceId },
      });

      logger.info(
        { knowledgeSourceId: job.knowledgeSourceId },
        'Deletion completed for knowledge source'
      );
    } catch (error: any) {
      logger.error(
        { knowledgeSourceId: job.knowledgeSourceId, error: error.message },
        'Deletion failed for knowledge source'
      );
      // Mark as failed deletion so the user knows it didn't fully delete
      await prisma.knowledgeSource.updateMany({
        where: { id: job.knowledgeSourceId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }
}

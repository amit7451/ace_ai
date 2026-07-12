import { prisma } from '@ion-ai/database';
import { IStorageProvider } from '@ion-ai/storage';
import { ParserFactory } from '@ion-ai/parser';
import {
  KnowledgeProcessor,
  EmbeddingProviderFactory,
  VectorStoreProviderFactory,
} from '@ai-chatbot-platform/ai-core';
import { UploadJobPayload } from '@ion-ai/queue';
import { env } from '@ion-ai/config';

export class IngestionPipeline {
  constructor(
    private storageProvider: IStorageProvider,
    private qdrantUrl: string
  ) {}

  async processUploadJob(job: UploadJobPayload, jobId: string) {
    console.log(`Starting ingestion job for ${job.documentId} in org ${job.organizationId}`);

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
      const orgConfig = await prisma.organizationConfiguration.findUnique({
        where: { organizationId: job.organizationId },
      });
      const providerName = (orgConfig?.embeddingProvider ?? 'openai') as 'openai' | 'gemini';
      const model = providerName === 'gemini' ? 'gemini-embedding-001' : 'text-embedding-3-small';
      const apiKey = providerName === 'gemini' ? env.GEMINI_API_KEY : env.OPENAI_API_KEY;

      const embedder = EmbeddingProviderFactory.create({
        provider: providerName,
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

      const vectors = chunks.map((c, i) => ({
        id: c.chunkId,
        vector: embeddings.embeddings[i].embedding,
        payload: {
          organizationId: job.organizationId,
          knowledgeSourceId: job.knowledgeSourceId,
          documentId: job.documentId,
          chunkIndex: c.chunkIndex,
          text: c.text,
          metadata: c.metadata,
        },
      }));

      await vectorStore.upsertBatch(collectionName, vectors);

      // 6. Store metadata in Postgres
      for (const vector of vectors) {
        await prisma.chunk.create({
          data: {
            documentId: job.documentId,
            chunkIndex: vector.payload.chunkIndex as number,
            tokenCount: chunks[vector.payload.chunkIndex as number].tokenCount,
            vectorId: vector.id,
            metadata: (vector.payload.metadata as any) ?? {},
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

      console.log(`Ingestion completed for ${job.documentId}`);
    } catch (error: any) {
      console.error(`Ingestion failed for ${job.documentId}:`, error);
      await prisma.ingestionJob.updateMany({
        where: { knowledgeSourceId: job.knowledgeSourceId },
        data: {
          status: 'FAILED',
          failureReason: error.message,
          finishedAt: new Date(),
        },
      });
      await prisma.knowledgeSource.update({
        where: { id: job.knowledgeSourceId },
        data: { status: 'FAILED' },
      });
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
    console.log(`Starting delete job for ${job.documentId} in org ${job.organizationId}`);
    try {
      // 1. Delete from R2 Storage
      try {
        console.log(`Deleting from R2: ${job.storageKey}`);
        await this.storageProvider.delete(job.storageKey);
        console.log(`Successfully deleted from R2: ${job.storageKey}`);
      } catch (e: any) {
        console.error(`R2 Deletion Error:`, e);
        throw e;
      }

      // 2. Delete from Qdrant Vector Store
      try {
        const collectionName = `org_${job.organizationId.replace(/-/g, '_')}`;
        const vectorStore = VectorStoreProviderFactory.create({
          provider: 'qdrant',
          url: this.qdrantUrl,
        });

        // Get chunks to find vector IDs
        const chunks = await prisma.chunk.findMany({
          where: { documentId: job.documentId },
          select: { vectorId: true },
        });
        const vectorIds = chunks.map((c) => c.vectorId).filter(Boolean) as string[];

        if (vectorIds.length > 0) {
          await vectorStore.delete(collectionName, vectorIds);
        }
      } catch (e: any) {
        console.error(`Qdrant Deletion Error:`, e);
        throw e;
      }

      // 3. Delete from Postgres
      // Due to cascade delete settings, deleting the KnowledgeSource might delete Document and Chunks automatically.
      // But let's safely delete them in order if cascade isn't set up.
      await prisma.chunk.deleteMany({
        where: { documentId: job.documentId },
      });
      await prisma.document.deleteMany({
        where: { id: job.documentId },
      });
      await prisma.ingestionJob.deleteMany({
        where: { knowledgeSourceId: job.knowledgeSourceId },
      });
      await prisma.knowledgeSource.deleteMany({
        where: { id: job.knowledgeSourceId },
      });

      console.log(`Deletion completed for ${job.documentId}`);
    } catch (error: any) {
      console.error(`Deletion failed for ${job.documentId}:`, error);
      // Mark as failed deletion so the user knows it didn't fully delete
      await prisma.knowledgeSource.updateMany({
        where: { id: job.knowledgeSourceId },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }
}

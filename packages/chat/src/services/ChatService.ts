import { prisma } from '@ion-ai/database';
import {
  RagOrchestrator,
  LLMProviderFactory,
  EmbeddingProviderFactory,
  VectorStoreProviderFactory,
  RagRetriever,
  RagPromptBuilder,
  ChatStreamChunk,
} from '@ai-chatbot-platform/ai-core';
import { PrismaMemoryProvider } from './PrismaMemoryProvider';
import { env } from '@ion-ai/config';

export class ChatService {
  async createOrchestrator(organizationId: string) {
    const orgConfig = await prisma.organizationConfiguration.findUnique({
      where: { organizationId },
    });

    if (!orgConfig) {
      throw new Error('Organization configuration not found');
    }

    const llm = LLMProviderFactory.create({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY as string,
      model: orgConfig.llmProvider,
    });
    const embedder = EmbeddingProviderFactory.create({
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY as string,
      model: 'text-embedding-3-small',
    });
    const vectorStore = VectorStoreProviderFactory.create({
      provider: 'qdrant',
      url: env.QDRANT_URL as string,
      apiKey: process.env.QDRANT_API_KEY as string,
    });

    const retriever = new RagRetriever(embedder, vectorStore, {
      topK: 5,
      scoreThreshold: 0.7,
      collection: `org_${organizationId}`,
    });
    const memory = new PrismaMemoryProvider();
    const promptBuilder = new RagPromptBuilder({
      systemPrompt: orgConfig.systemPrompt || 'You are a helpful AI assistant.',
    });

    return new RagOrchestrator(retriever, memory, promptBuilder, llm);
  }

  async streamChat(
    organizationId: string,
    conversationId: string,
    query: string
  ): Promise<AsyncGenerator<ChatStreamChunk>> {
    const orchestrator = await this.createOrchestrator(organizationId);

    return orchestrator.stream({
      tenantId: organizationId,
      assistantId: 'default',
      sessionId: conversationId,
      query,
    });
  }
}

export const chatService = new ChatService();

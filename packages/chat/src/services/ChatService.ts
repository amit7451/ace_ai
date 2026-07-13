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

    const llmProvider = (orgConfig.llmProvider || 'openai') as any;
    const llmApiKey =
      llmProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY;
    const llmModel = llmProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';

    console.log(`[ChatService] Initializing LLM: provider=${llmProvider}, model=${llmModel}`);

    const llm = LLMProviderFactory.create({
      provider: llmProvider,
      apiKey: llmApiKey as string,
      model: llmModel,
    });

    const embedderProvider = (orgConfig.embeddingProvider || 'openai') as any;
    const embedderApiKey =
      embedderProvider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY;
    const embedderModel =
      embedderProvider === 'gemini' ? 'gemini-embedding-001' : 'text-embedding-3-small';

    console.log(
      `[ChatService] Initializing Embedder: provider=${embedderProvider}, model=${embedderModel}`
    );

    const embedder = EmbeddingProviderFactory.create({
      provider: embedderProvider,
      apiKey: embedderApiKey as string,
      model: embedderModel,
    });

    const vectorStore = VectorStoreProviderFactory.create({
      provider: 'qdrant',
      url: env.QDRANT_URL as string,
      apiKey: process.env.QDRANT_API_KEY as string,
    });

    const collectionName = `org_${organizationId.replace(/-/g, '_')}`;

    const retriever = new RagRetriever(embedder, vectorStore, {
      topK: 5,
      scoreThreshold: 0.7,
      collection: collectionName,
    });
    const memory = new PrismaMemoryProvider();

    const promptBuilder = new RagPromptBuilder({
      systemPrompt: orgConfig.systemPrompt || 'You are a helpful AI assistant.',
      fallbackStrategy: 'instruct_llm',
      fallbackInstruction: `STRICT DOMAIN GUARDRAIL: No relevant context was found in the knowledge base for the user's latest query. 
You MUST NOT use your pre-trained world knowledge to answer questions about sports, news, history, or general trivia. 
Your ONLY allowed actions are:
1. If the user's query can be confidently answered using ONLY the provided Conversation History, you may answer it.
2. If the user is just saying a basic greeting (like hello, hi, hey), respond normally.
3. OTHERWISE, you MUST politely decline to answer and state that you do not have the provided context to answer.`,
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

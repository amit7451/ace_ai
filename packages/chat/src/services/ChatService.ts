import { chatRepository } from '../repositories/ChatRepository';
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
  async createOrchestrator(organizationId: string, context: 'playground' | 'widget') {
    const orgConfig = await chatRepository.getOrganizationConfig(organizationId);

    if (!orgConfig) {
      throw new Error('Organization configuration not found');
    }

    const llmProvider = (orgConfig.llmProvider || 'openai') as string;
    let llmApiKey: string;
    let llmProviderName = llmProvider;
    let llmModel = 'gpt-4o-mini';

    if (llmProvider === 'testing') {
      if (context === 'widget') {
        throw new Error(
          'The "testing" provider is only available in the playground. Please configure your own API key for live widgets.'
        );
      }
      llmProviderName = 'gemini';
      llmApiKey = process.env.GEMINI_API_KEY || '';
      llmModel = 'gemini-2.5-flash';
    } else {
      const apiKeyRecord = await chatRepository.getOrganizationApiKey(organizationId, llmProvider);
      if (!apiKeyRecord) {
        throw new Error(`API key for provider '${llmProvider}' is not configured.`);
      }
      const { decryptApiKey } = await import('@ion-ai/config');
      llmApiKey = decryptApiKey(apiKeyRecord.encryptedKey);
      llmModel = llmProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';
    }

    console.log(`[ChatService] Initializing LLM: provider=${llmProviderName}, model=${llmModel}`);

    const llm = LLMProviderFactory.create({
      provider: llmProviderName as any,
      apiKey: llmApiKey,
      model: llmModel,
      temperature: orgConfig.temperature ?? 0.7,
      maxTokens: orgConfig.maxTokens ?? undefined,
    });

    const embedderProvider = (orgConfig.embeddingProvider || 'openai') as string;
    let embedderApiKey: string;
    let embedderProviderName = embedderProvider;
    let embedderModel = 'text-embedding-3-small';

    if (embedderProvider === 'testing') {
      embedderProviderName = 'gemini';
      embedderApiKey = process.env.GEMINI_API_KEY || '';
      embedderModel = 'gemini-embedding-001';
    } else {
      const apiKeyRecord = await chatRepository.getOrganizationApiKey(
        organizationId,
        embedderProvider
      );
      if (!apiKeyRecord) {
        throw new Error(`API key for embedding provider '${embedderProvider}' is not configured.`);
      }
      const { decryptApiKey } = await import('@ion-ai/config');
      embedderApiKey = decryptApiKey(apiKeyRecord.encryptedKey);
      embedderModel =
        embedderProvider === 'gemini' ? 'gemini-embedding-001' : 'text-embedding-3-small';
    }

    console.log(
      `[ChatService] Initializing Embedder: provider=${embedderProviderName}, model=${embedderModel}`
    );

    const embedder = EmbeddingProviderFactory.create({
      provider: embedderProviderName as any,
      apiKey: embedderApiKey,
      model: embedderModel,
    });

    const vectorStore = VectorStoreProviderFactory.create({
      provider: 'qdrant',
      url: env.QDRANT_URL as string,
      apiKey: process.env.QDRANT_API_KEY as string,
    });

    const collectionName = `org_${organizationId.replace(/-/g, '_')}`;

    const retriever = new RagRetriever(embedder, vectorStore, {
      topK: orgConfig.topK ?? 5,
      scoreThreshold: orgConfig.scoreThreshold ?? 0.7,
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
    query: string,
    context: 'playground' | 'widget'
  ): Promise<{ stream: AsyncGenerator<ChatStreamChunk>; welcomeMessage?: string }> {
    const orchestrator = await this.createOrchestrator(organizationId, context);
    const orgConfig = await chatRepository.getOrganizationConfig(organizationId);

    return {
      stream: orchestrator.stream({
        tenantId: organizationId,
        assistantId: 'default',
        sessionId: conversationId,
        query,
      }),
      welcomeMessage: orgConfig?.welcomeMessage || 'Hi there! How can I help you today?',
    };
  }

  async validatePlaygroundAccess(userId: string, organizationId: string) {
    const member = await chatRepository.getOrganizationMember(userId, organizationId);
    if (!member) {
      throw new Error('Unauthorized for this organization');
    }
    return member;
  }

  async getOrCreateVisitorSession(organizationId: string, ipHash: string, userAgent: string) {
    let visitor = await chatRepository.getVisitorSession(organizationId, ipHash);
    if (!visitor) {
      visitor = await chatRepository.createVisitorSession({ organizationId, ipHash, userAgent });
    }
    return visitor;
  }

  async getWelcomeMessage(organizationId: string) {
    const config = await chatRepository.getOrganizationConfig(organizationId);
    return config?.welcomeMessage || 'Hi there! How can I help you today?';
  }
}

export const chatService = new ChatService();

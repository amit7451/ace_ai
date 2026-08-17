import { chatRepository } from '../repositories/ChatRepository';
import {
  RagOrchestrator,
  LLMProviderFactory,
  EmbeddingProviderFactory,
  VectorStoreProviderFactory,
  RagRetriever,
  RagPromptBuilder,
  ChatStreamChunk,
  LLMError,
} from '@ai-chatbot-platform/ai-core';
import { PrismaMemoryProvider } from './PrismaMemoryProvider';
import { rateLimitService } from './RateLimitService';
import { env } from '@ion-ai/config';
import type { InstitutionSupportInfo, KeySourceType } from '@ion-ai/contracts';

const DEFAULT_LLM_MODELS: Record<string, string> = {
  gemini: 'gemini-1.5-flash',
  testing: 'gemini-1.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'meta-llama/llama-3.3-70b-instruct',
  ollama: 'llama3.2',
};

const DEFAULT_EMBEDDING_MODELS: Record<string, string> = {
  gemini: 'gemini-embedding-001',
  testing: 'gemini-embedding-001',
  openai: 'text-embedding-3-small',
  cohere: 'embed-english-v3.0',
  ollama: 'nomic-embed-text',
};

export class ChatService {
  async createOrchestrator(organizationId: string, context: 'playground' | 'widget') {
    const orgConfig = await chatRepository.getOrganizationConfig(organizationId);

    if (!orgConfig) {
      throw new Error('Organization configuration not found');
    }

    const llmProviderRaw = (orgConfig.llmProvider || 'testing') as string;
    let llmApiKey: string = '';
    let llmProviderName = llmProviderRaw;
    let llmModel = orgConfig.llmModel || DEFAULT_LLM_MODELS[llmProviderRaw] || 'gpt-4o-mini';
    let keySource: KeySourceType = 'ORGANIZATION_CUSTOM_KEY';

    if (llmProviderRaw === 'testing') {
      llmProviderName = 'gemini';
      if (!orgConfig.llmModel) {
        llmModel = env.LLM_MODEL || DEFAULT_LLM_MODELS.gemini;
      }
      if (context === 'widget') {
        throw new Error(
          'The "testing" provider is only available in the playground. Please configure your own API key for live widgets.'
        );
      }

      const apiKeyRecord = await chatRepository.getOrganizationApiKey(organizationId, 'gemini');
      if (apiKeyRecord) {
        const { decryptApiKey } = await import('@ion-ai/config');
        llmApiKey = decryptApiKey(apiKeyRecord.encryptedKey);
        keySource = 'ORGANIZATION_CUSTOM_KEY';
      } else {
        llmApiKey = env.GEMINI_API_KEY || '';
        keySource = 'SYSTEM_FREE_TIER';
      }

      if (!llmApiKey) {
        throw new Error(`Global GEMINI_API_KEY for testing provider is not configured.`);
      }
    } else if (llmProviderRaw === 'ollama') {
      llmProviderName = 'ollama';
      llmApiKey = 'ollama-local';
      keySource = 'ORGANIZATION_CUSTOM_KEY';
    } else {
      llmProviderName = llmProviderRaw;
      const apiKeyRecord = await chatRepository.getOrganizationApiKey(
        organizationId,
        llmProviderRaw
      );
      if (apiKeyRecord) {
        const { decryptApiKey } = await import('@ion-ai/config');
        llmApiKey = decryptApiKey(apiKeyRecord.encryptedKey);
        keySource = 'ORGANIZATION_CUSTOM_KEY';
      } else if (llmProviderRaw === 'gemini') {
        if (context === 'widget') {
          throw new Error('API key for Google Gemini is required for live widgets.');
        }
        llmApiKey = env.GEMINI_API_KEY || '';
        keySource = 'SYSTEM_FREE_TIER';
      }

      if (!llmApiKey) {
        throw new Error(`API key for provider '${llmProviderRaw}' is not configured.`);
      }
    }

    // Cost guardrail: clamp max output tokens on free tier
    const resolvedMaxTokens =
      keySource === 'SYSTEM_FREE_TIER'
        ? Math.min(
            orgConfig.maxTokens ?? env.MAX_FREE_TIER_OUTPUT_TOKENS,
            env.MAX_FREE_TIER_OUTPUT_TOKENS
          )
        : (orgConfig.maxTokens ?? undefined);

    console.log(
      `[ChatService] Initializing LLM: provider=${llmProviderName}, model=${llmModel}, keySource=${keySource}, maxTokens=${resolvedMaxTokens}`
    );

    const llm = LLMProviderFactory.create({
      provider: llmProviderName as any,
      apiKey: llmApiKey,
      model: llmModel,
      temperature: orgConfig.temperature ?? 0.7,
      maxTokens: resolvedMaxTokens,
    });

    const embedderProviderRaw = (orgConfig.embeddingProvider || 'testing') as string;
    let embedderApiKey: string = '';
    let embedderProviderName = embedderProviderRaw;
    let embedderModel =
      orgConfig.embeddingModel ||
      DEFAULT_EMBEDDING_MODELS[embedderProviderRaw] ||
      'text-embedding-3-small';

    if (embedderProviderRaw === 'testing') {
      embedderProviderName = 'gemini';
      if (!orgConfig.embeddingModel) {
        embedderModel = env.EMBEDDING_MODEL || 'gemini-embedding-001';
      }

      const apiKeyRecord = await chatRepository.getOrganizationApiKey(organizationId, 'gemini');
      if (apiKeyRecord) {
        const { decryptApiKey } = await import('@ion-ai/config');
        embedderApiKey = decryptApiKey(apiKeyRecord.encryptedKey);
      } else {
        embedderApiKey = env.GEMINI_API_KEY || '';
      }

      if (!embedderApiKey) {
        throw new Error(`Global GEMINI_API_KEY for testing embedding provider is not configured.`);
      }
    } else if (embedderProviderRaw === 'ollama') {
      embedderProviderName = 'ollama';
      embedderApiKey = 'ollama-local';
    } else {
      embedderProviderName = embedderProviderRaw;
      const apiKeyRecord = await chatRepository.getOrganizationApiKey(
        organizationId,
        embedderProviderRaw
      );
      if (apiKeyRecord) {
        const { decryptApiKey } = await import('@ion-ai/config');
        embedderApiKey = decryptApiKey(apiKeyRecord.encryptedKey);
      } else if (embedderProviderRaw === 'gemini') {
        embedderApiKey = env.GEMINI_API_KEY || '';
      }

      if (!embedderApiKey) {
        throw new Error(
          `API key for embedding provider '${embedderProviderRaw}' is not configured.`
        );
      }
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
      apiKey: env.QDRANT_API_KEY,
    });

    const collectionName = `org_${organizationId.replace(/-/g, '_')}`;

    // Cost guardrail: clamp retrieval topK on free tier
    const resolvedTopK =
      keySource === 'SYSTEM_FREE_TIER'
        ? Math.min(orgConfig.topK ?? env.MAX_FREE_TIER_TOP_K, env.MAX_FREE_TIER_TOP_K)
        : (orgConfig.topK ?? 5);

    const retriever = new RagRetriever(embedder, vectorStore, {
      topK: resolvedTopK,
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

    const institutionSupport: InstitutionSupportInfo = {
      institutionName: orgConfig.institutionName || undefined,
      supportEmail: orgConfig.supportEmail || undefined,
      supportWebsite: orgConfig.supportWebsite || undefined,
      supportPhone: orgConfig.supportPhone || undefined,
      introductoryMessage: orgConfig.introductoryMessage || undefined,
    };

    return {
      orchestrator: new RagOrchestrator(retriever, memory, promptBuilder, llm),
      keySource,
      institutionSupport,
      welcomeMessage:
        orgConfig.introductoryMessage ||
        orgConfig.welcomeMessage ||
        'Hi there! How can I help you today?',
    };
  }

  async streamChat(
    organizationId: string,
    conversationId: string,
    query: string,
    context: 'playground' | 'widget'
  ): Promise<{
    stream: AsyncGenerator<ChatStreamChunk>;
    welcomeMessage?: string;
    keySource: KeySourceType;
    institutionSupport: InstitutionSupportInfo;
  }> {
    const { orchestrator, keySource, institutionSupport, welcomeMessage } =
      await this.createOrchestrator(organizationId, context);

    // Enforce global shared key and daily quota protection when on system free tier
    if (keySource === 'SYSTEM_FREE_TIER') {
      await rateLimitService.checkGlobalSharedKeyLimit();
      await rateLimitService.checkDailyFreeTierLimit(
        organizationId,
        env.DAILY_FREE_TIER_REQUEST_LIMIT
      );
    }

    return {
      stream: orchestrator.stream({
        tenantId: organizationId,
        assistantId: 'default',
        sessionId: conversationId,
        query,
      }),
      welcomeMessage,
      keySource,
      institutionSupport,
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
    return chatRepository.upsertVisitorSession(organizationId, ipHash, userAgent);
  }

  async getWelcomeMessage(organizationId: string) {
    const config = await chatRepository.getOrganizationConfig(organizationId);
    return (
      config?.introductoryMessage || config?.welcomeMessage || 'Hi there! How can I help you today?'
    );
  }

  async getInstitutionDetails(organizationId: string): Promise<InstitutionSupportInfo> {
    const config = await chatRepository.getOrganizationConfig(organizationId);
    return {
      institutionName: config?.institutionName || undefined,
      supportEmail: config?.supportEmail || undefined,
      supportWebsite: config?.supportWebsite || undefined,
      supportPhone: config?.supportPhone || undefined,
      introductoryMessage: config?.introductoryMessage || undefined,
    };
  }
}

export const chatService = new ChatService();

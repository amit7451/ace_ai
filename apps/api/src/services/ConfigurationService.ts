import { ConfigurationRepository } from '../repositories/ConfigurationRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { UpdateOrganizationConfigurationRequest } from '@ion-ai/contracts';
import { Role, hasPermission } from '@ion-ai/auth';
import { encryptApiKey, decryptApiKey, env } from '@ion-ai/config';

export class ConfigurationService {
  constructor(
    private configRepo: ConfigurationRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async getConfiguration(organizationId: string) {
    let config = await this.configRepo.findByOrganizationId(organizationId);
    if (!config) {
      // Return defaults if none exists
      config = await this.configRepo.upsert(organizationId, {
        organizationId,
        llmProvider: 'testing',
        embeddingProvider: 'testing',
        temperature: 0.7,
      });
    }
    return config;
  }

  async updateConfiguration(
    organizationId: string,
    actorId: string,
    actorRole: Role,
    data: UpdateOrganizationConfigurationRequest
  ) {
    if (!hasPermission(actorRole, Role.ADMIN)) {
      throw Object.assign(new Error('Insufficient permissions to update configuration'), {
        statusCode: 403,
      });
    }

    const config = await this.configRepo.upsert(organizationId, {
      organizationId,
      ...data,
    });

    await this.auditRepo.create({
      organizationId,
      action: 'CONFIGURATION_UPDATED',
      actorId,
      metadata: data,
    });

    return config;
  }

  async getApiKeys(organizationId: string) {
    const keys = await this.configRepo.findApiKeysByOrganizationId(organizationId);
    return keys.map((k) => ({
      provider: k.provider,
      hasKey: true,
      updatedAt: k.updatedAt,
    }));
  }

  async getDecryptedApiKey(organizationId: string, provider: string): Promise<string | null> {
    const key = await this.configRepo.getApiKey(organizationId, provider);
    if (!key) return null;
    return decryptApiKey(key.encryptedKey);
  }

  async saveApiKey(
    organizationId: string,
    actorId: string,
    actorRole: Role,
    provider: string,
    apiKey: string
  ) {
    if (!hasPermission(actorRole, Role.ADMIN)) {
      throw Object.assign(new Error('Insufficient permissions to manage API keys'), {
        statusCode: 403,
      });
    }
    const encryptedKey = encryptApiKey(apiKey);
    await this.configRepo.upsertApiKey(organizationId, provider, encryptedKey);
    await this.auditRepo.create({
      organizationId,
      action: 'API_KEY_UPDATED',
      actorId,
      metadata: { provider },
    });
    return { success: true };
  }

  async deleteApiKey(organizationId: string, actorId: string, actorRole: Role, provider: string) {
    if (!hasPermission(actorRole, Role.ADMIN)) {
      throw Object.assign(new Error('Insufficient permissions to manage API keys'), {
        statusCode: 403,
      });
    }
    await this.configRepo.deleteApiKey(organizationId, provider);
    await this.auditRepo.create({
      organizationId,
      action: 'API_KEY_DELETED',
      actorId,
      metadata: { provider },
    });
    return { success: true };
  }

  async getAvailableModels(
    organizationId: string,
    provider: string,
    type: 'llm' | 'embedding' = 'llm'
  ): Promise<{
    provider: string;
    type: 'llm' | 'embedding';
    models: Array<{ id: string; name: string }>;
    live: boolean;
  }> {
    const fallback = FALLBACK_MODELS[provider]?.[type] || [];

    try {
      if (provider === 'testing' || provider === 'gemini') {
        let apiKey = await this.getDecryptedApiKey(organizationId, 'gemini');
        if (!apiKey) {
          apiKey = env.GEMINI_API_KEY || '';
        }

        if (apiKey) {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (res.ok) {
            const data: any = await res.json();
            const rawModels: any[] = data.models || [];
            const targetMethod = type === 'llm' ? 'generateContent' : 'embedContent';
            const filtered = rawModels
              .filter((m) => m.supportedGenerationMethods?.includes(targetMethod))
              .map((m) => {
                const cleanId = m.name.replace(/^models\//, '');
                return {
                  id: cleanId,
                  name: m.displayName ? `${m.displayName} (${cleanId})` : cleanId,
                };
              });

            if (filtered.length > 0) {
              return { provider, type, models: filtered, live: true };
            }
          }
        }
      } else if (provider === 'openai') {
        const apiKey =
          (await this.getDecryptedApiKey(organizationId, 'openai')) || env.OPENAI_API_KEY;
        if (apiKey) {
          const res = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data: any = await res.json();
            const rawModels: any[] = data.data || [];
            let filtered: any[] = [];
            if (type === 'llm') {
              filtered = rawModels
                .filter(
                  (m) =>
                    (m.id.startsWith('gpt-') ||
                      m.id.startsWith('o1') ||
                      m.id.startsWith('o3') ||
                      m.id.startsWith('chatgpt')) &&
                    !m.id.includes('realtime') &&
                    !m.id.includes('audio')
                )
                .map((m) => ({ id: m.id, name: m.id }));
            } else {
              filtered = rawModels
                .filter((m) => m.id.includes('embedding'))
                .map((m) => ({ id: m.id, name: m.id }));
            }
            if (filtered.length > 0) {
              return { provider, type, models: filtered, live: true };
            }
          }
        }
      } else if (provider === 'anthropic' && type === 'llm') {
        const apiKey =
          (await this.getDecryptedApiKey(organizationId, 'anthropic')) || env.ANTHROPIC_API_KEY;
        if (apiKey) {
          const res = await fetch('https://api.anthropic.com/v1/models', {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data: any = await res.json();
            const rawModels: any[] = data.data || [];
            const filtered = rawModels.map((m) => ({
              id: m.id,
              name: m.display_name ? `${m.display_name} (${m.id})` : m.id,
            }));
            if (filtered.length > 0) {
              return { provider, type, models: filtered, live: true };
            }
          }
        }
      } else if (provider === 'groq' && type === 'llm') {
        const apiKey = (await this.getDecryptedApiKey(organizationId, 'groq')) || env.GROQ_API_KEY;
        if (apiKey) {
          const res = await fetch('https://api.groq.com/openai/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data: any = await res.json();
            const rawModels: any[] = data.data || [];
            const filtered = rawModels
              .filter((m) => m.active !== false)
              .map((m) => ({ id: m.id, name: m.id }));
            if (filtered.length > 0) {
              return { provider, type, models: filtered, live: true };
            }
          }
        }
      } else if (provider === 'openrouter' && type === 'llm') {
        const apiKey =
          (await this.getDecryptedApiKey(organizationId, 'openrouter')) || env.OPENROUTER_API_KEY;
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          const data: any = await res.json();
          const rawModels: any[] = data.data || [];
          const filtered = rawModels.slice(0, 50).map((m) => ({
            id: m.id,
            name: m.name ? `${m.name} (${m.id})` : m.id,
          }));
          if (filtered.length > 0) {
            return { provider, type, models: filtered, live: true };
          }
        }
      } else if (provider === 'cohere' && type === 'embedding') {
        const apiKey =
          (await this.getDecryptedApiKey(organizationId, 'cohere')) || env.COHERE_API_KEY;
        if (apiKey) {
          const res = await fetch('https://api.cohere.com/v1/models?endpoint=embed', {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const data: any = await res.json();
            const rawModels: any[] = data.models || [];
            const filtered = rawModels.map((m) => ({ id: m.name, name: m.name }));
            if (filtered.length > 0) {
              return { provider, type, models: filtered, live: true };
            }
          }
        }
      } else if (provider === 'ollama') {
        const res = await fetch('http://localhost:11434/api/tags', {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const data: any = await res.json();
          const rawModels: any[] = data.models || [];
          const filtered = rawModels.map((m) => ({ id: m.name, name: m.name }));
          if (filtered.length > 0) {
            return { provider, type, models: filtered, live: true };
          }
        }
      }
    } catch (err) {
      // Gracefully fall back to static list
    }

    return { provider, type, models: fallback, live: false };
  }
}

const FALLBACK_MODELS: Record<
  string,
  { llm: Array<{ id: string; name: string }>; embedding: Array<{ id: string; name: string }> }
> = {
  gemini: {
    llm: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Recommended)' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    ],
    embedding: [
      { id: 'gemini-embedding-001', name: 'Gemini Embedding 001' },
      { id: 'gemini-embedding-2-preview', name: 'Gemini Embedding 2 Preview' },
      { id: 'gemini-embedding-2', name: 'Gemini Embedding 2' },
    ],
  },
  openai: {
    llm: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Affordable)' },
      { id: 'gpt-4o', name: 'GPT-4o (High Intelligence)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'o1-mini', name: 'o1-mini (Reasoning)' },
      { id: 'o3-mini', name: 'o3-mini (Reasoning)' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
    embedding: [
      { id: 'text-embedding-3-small', name: 'text-embedding-3-small (1536d - Recommended)' },
      { id: 'text-embedding-3-large', name: 'text-embedding-3-large (3072d)' },
      { id: 'text-embedding-ada-002', name: 'text-embedding-ada-002 (1536d)' },
    ],
  },
  anthropic: {
    llm: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Recommended)' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    ],
    embedding: [],
  },
  groq: {
    llm: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Recommended)' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Ultra Fast)' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT' },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill Llama 70B' },
    ],
    embedding: [],
  },
  openrouter: {
    llm: [
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Meta Llama 3.3 70B Instruct' },
      { id: 'openai/gpt-4o-mini', name: 'OpenAI GPT-4o Mini' },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic Claude 3.5 Sonnet' },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Google Gemini 2.0 Flash (Free)' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
    ],
    embedding: [],
  },
  cohere: {
    llm: [],
    embedding: [
      { id: 'embed-english-v3.0', name: 'embed-english-v3.0 (1024d - Recommended)' },
      { id: 'embed-multilingual-v3.0', name: 'embed-multilingual-v3.0 (1024d)' },
      { id: 'embed-english-light-v3.0', name: 'embed-english-light-v3.0 (384d)' },
      { id: 'embed-multilingual-light-v3.0', name: 'embed-multilingual-light-v3.0 (384d)' },
    ],
  },
  ollama: {
    llm: [
      { id: 'llama3.2', name: 'Llama 3.2 (Default)' },
      { id: 'llama3', name: 'Llama 3' },
      { id: 'mistral', name: 'Mistral 7B' },
      { id: 'gemma2', name: 'Gemma 2' },
      { id: 'qwen2.5', name: 'Qwen 2.5' },
    ],
    embedding: [
      { id: 'nomic-embed-text', name: 'nomic-embed-text (768d - Default)' },
      { id: 'all-minilm', name: 'all-minilm (384d)' },
      { id: 'bge-m3', name: 'bge-m3 (1024d)' },
      { id: 'mxbai-embed-large', name: 'mxbai-embed-large (1024d)' },
    ],
  },
  testing: {
    llm: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Global Env)' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Global Env)' },
    ],
    embedding: [{ id: 'gemini-embedding-001', name: 'Gemini Embedding 001 (Global Env - 768d)' }],
  },
};

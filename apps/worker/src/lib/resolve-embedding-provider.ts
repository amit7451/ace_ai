import { prisma } from '@ion-ai/database';
import { env } from '@ion-ai/config';

export interface ResolvedEmbeddingProvider {
  providerName: string;
  model: string;
  apiKey: string;
}

const DEFAULT_EMBEDDING_MODELS: Record<string, string> = {
  gemini: 'gemini-embedding-001',
  testing: 'gemini-embedding-001',
  openai: 'text-embedding-3-small',
  cohere: 'embed-english-v3.0',
  ollama: 'nomic-embed-text',
};

export async function resolveEmbeddingProvider(
  organizationId: string
): Promise<ResolvedEmbeddingProvider> {
  const orgConfig = await prisma.organizationConfiguration.findUnique({
    where: { organizationId },
  });
  const providerNameRaw = (orgConfig?.embeddingProvider ?? 'testing') as string;
  let providerName = providerNameRaw;
  let model =
    orgConfig?.embeddingModel ||
    DEFAULT_EMBEDDING_MODELS[providerNameRaw] ||
    'text-embedding-3-small';
  let apiKey = '';

  if (providerNameRaw === 'testing') {
    providerName = 'gemini';
    if (!orgConfig?.embeddingModel) {
      model = process.env.EMBEDDING_MODEL || 'gemini-embedding-001';
    }

    const apiKeyRecord = await prisma.organizationApiKey.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider: 'gemini',
        },
      },
    });

    if (apiKeyRecord) {
      const { decryptApiKey } = await import('@ion-ai/config');
      apiKey = decryptApiKey(apiKeyRecord.encryptedKey);
    } else {
      apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';
    }

    if (!apiKey) {
      throw new Error(
        `Global GEMINI_API_KEY for testing embedding provider is not configured in environment.`
      );
    }
  } else if (providerNameRaw === 'ollama') {
    providerName = 'ollama';
    apiKey = 'ollama-local';
  } else {
    providerName = providerNameRaw;
    const apiKeyRecord = await prisma.organizationApiKey.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider: providerNameRaw,
        },
      },
    });

    if (apiKeyRecord) {
      const { decryptApiKey } = await import('@ion-ai/config');
      apiKey = decryptApiKey(apiKeyRecord.encryptedKey);
    } else if (providerNameRaw === 'gemini') {
      apiKey = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || '';
    }

    if (!apiKey) {
      throw new Error(`API key for embedding provider '${providerNameRaw}' is not configured.`);
    }
  }

  return { providerName, model, apiKey };
}

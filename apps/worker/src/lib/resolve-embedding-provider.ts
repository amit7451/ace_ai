import { prisma } from '@ion-ai/database';
import { env } from '@ion-ai/config';

export interface ResolvedEmbeddingProvider {
  providerName: string;
  model: string;
  apiKey: string;
}

export async function resolveEmbeddingProvider(
  organizationId: string
): Promise<ResolvedEmbeddingProvider> {
  const orgConfig = await prisma.organizationConfiguration.findUnique({
    where: { organizationId },
  });
  const providerNameRaw = (orgConfig?.embeddingProvider ?? 'openai') as string;
  let providerName = providerNameRaw;
  let model = 'text-embedding-3-small';
  let apiKey = '';

  if (providerNameRaw === 'testing' || providerNameRaw === 'gemini') {
    providerName = 'gemini';
    model = 'gemini-embedding-001';

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
        `API key for embedding provider '${providerNameRaw}' is not configured in organization or system environment.`
      );
    }
  } else {
    const apiKeyRecord = await prisma.organizationApiKey.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider: providerNameRaw,
        },
      },
    });
    if (!apiKeyRecord) {
      throw new Error(`API key for embedding provider '${providerNameRaw}' is not configured.`);
    }
    const { decryptApiKey } = await import('@ion-ai/config');
    apiKey = decryptApiKey(apiKeyRecord.encryptedKey);
    model = providerNameRaw === 'gemini' ? 'gemini-embedding-001' : 'text-embedding-3-small';
  }

  return { providerName, model, apiKey };
}

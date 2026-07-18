import { prisma } from '@ion-ai/database';
import { env } from '@ion-ai/config';

export interface ResolvedEmbeddingProvider {
  providerName: string;
  model: string;
  apiKey: string;
}

/**
 * Resolves which embedding provider/model/key to use for a given
 * organization. This is the exact same resolution logic
 * `ingestion.pipeline.ts` inlines for file uploads — pulled out here so the
 * crawler pipeline uses identical behavior (including the `'testing'`
 * provider escape hatch) rather than a second, possibly-drifting copy.
 *
 * `ingestion.pipeline.ts` itself isn't changed to call this — that's a
 * one-line follow-up if you want to de-duplicate it there too; both copies
 * behave identically today.
 */
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

  if (providerNameRaw === 'testing') {
    providerName = 'gemini';
    model = 'gemini-embedding-001';
    apiKey = env.GEMINI_API_KEY || '';
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

import { VectorStoreConfig } from '../types/vector-store-config.types';
import { IVectorStore } from '../interfaces/vector-store.interface';
import { vectorStoreConfigSchema } from '../schemas/vector-store-config.schema';
import { VectorStoreInvalidRequestError } from '../errors/vector-store.errors';
import { QdrantVectorStoreProvider } from '../providers/qdrant/qdrant-vector-store.provider';

/**
 * Config in, `IVectorStore` out. The only place in this layer that knows
 * about concrete vendor classes — same role as
 * `EmbeddingProviderFactory.create()` in Component 2 and the LLM
 * provider factory in Component 1.
 */
export class VectorStoreProviderFactory {
  static create(config: VectorStoreConfig): IVectorStore {
    const parsed = vectorStoreConfigSchema.safeParse(config);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw new VectorStoreInvalidRequestError(`Invalid vector store configuration: ${details}`, {
        provider: (config as Partial<VectorStoreConfig>).provider ?? 'unknown',
      });
    }

    const validConfig = parsed.data as VectorStoreConfig;

    switch (validConfig.provider) {
      case 'qdrant':
        return new QdrantVectorStoreProvider(validConfig);
      default: {
        // Exhaustiveness guard. Unreachable while `VectorStoreProviderName`
        // has a single member and the schema enum is kept in sync with it —
        // see "Adding a new provider" in the README for what changes when
        // that's no longer true.
        const unknownProvider: never = validConfig.provider;
        throw new VectorStoreInvalidRequestError(`Unsupported vector store provider: "${unknownProvider}"`, {
          provider: String(unknownProvider),
        });
      }
    }
  }
}

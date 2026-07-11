import { embeddingConfigSchema } from '../schemas/embedding-config.schema';
import { EmbeddingConfig } from '../types/embedding-config.types';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { OpenAIEmbeddingProvider } from '../providers/openai/openai-embedding.provider';
import { GeminiEmbeddingProvider } from '../providers/gemini/gemini-embedding.provider';
import { CohereEmbeddingProvider } from '../providers/cohere/cohere-embedding.provider';
import { OllamaEmbeddingProvider } from '../providers/ollama/ollama-embedding.provider';
import { EmbeddingInvalidRequestError } from '../errors/embedding.errors';

/**
 * The only place that knows about concrete embedding vendor classes.
 * Everything else in the platform depends on `IEmbeddingProvider`. Mirrors
 * `LLMProviderFactory` from the LLM Provider Layer — switching embedding
 * providers is a config change, never a code change.
 */
export class EmbeddingProviderFactory {
  static create(config: EmbeddingConfig): IEmbeddingProvider {
    const parsed = embeddingConfigSchema.parse(config);

    switch (parsed.provider) {
      case 'openai':
        return new OpenAIEmbeddingProvider(parsed);
      case 'gemini':
        return new GeminiEmbeddingProvider(parsed);
      case 'cohere':
        return new CohereEmbeddingProvider(parsed);
      case 'ollama':
        return new OllamaEmbeddingProvider(parsed);
      default: {
        const exhaustiveCheck: never = parsed.provider;
        throw new EmbeddingInvalidRequestError(
          `Unsupported embedding provider: "${exhaustiveCheck}"`,
          'factory'
        );
      }
    }
  }
}

import { EmbeddingProviderName } from '../types/embedding-config.types';
import { EmbedOptions } from '../types/embedding-request.types';
import { EmbeddingResponse } from '../types/embedding-response.types';

/**
 * The single contract every embedding vendor implements. Application code —
 * the future Knowledge Chunking pipeline (Component 4) and RAG Retriever
 * (Component 5) — depends only on this interface, never on a concrete
 * vendor class. `EmbeddingProviderFactory.create(config)` is the only place
 * that knows about concrete implementations (mirrors `LLMProviderFactory`
 * from Component 1).
 */
export interface IEmbeddingProvider {
  readonly name: EmbeddingProviderName;
  readonly model: string;
  /** The dimensionality every returned vector is guaranteed to have. */
  readonly dimensions: number;

  /** Embed a single string. */
  embed(input: string, options?: EmbedOptions): Promise<EmbeddingResponse>;

  /**
   * Embed many strings. Internally chunks into vendor-safe batch sizes,
   * retries transient failures per-batch, and reassembles results in the
   * original input order — callers never need to think about batching.
   */
  embedBatch(inputs: string[], options?: EmbedOptions): Promise<EmbeddingResponse>;

  /** Cheap liveness check — does not necessarily perform a full embed call (see Ollama provider). */
  healthCheck(): Promise<boolean>;
}

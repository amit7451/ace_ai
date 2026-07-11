/**
 * Names of supported vector store vendors. Only Qdrant today — see the
 * package README ("Why Qdrant only, for now") for why this list is short
 * on purpose rather than stubbed out with unimplemented providers.
 */
export type VectorStoreProviderName = 'qdrant';

/**
 * Distance metrics Qdrant can compare vectors with. `cosine` is the right
 * default for text embeddings (OpenAI, Gemini, Cohere, and the Ollama
 * models this platform uses are all trained/evaluated for cosine or
 * normalized dot-product similarity).
 */
export type DistanceMetric = 'cosine' | 'euclid' | 'dot' | 'manhattan';

/**
 * Configuration accepted by `VectorStoreProviderFactory.create()`.
 *
 * Mirrors the shape of Component 2's `EmbeddingConfig`: a `provider`
 * discriminator plus connection details, so swapping vector store vendors
 * later is a config change in the same style as swapping embedding or LLM
 * vendors.
 */
export interface VectorStoreConfig {
  provider: VectorStoreProviderName;
  /** Base URL of the Qdrant instance, e.g. "http://localhost:6333". */
  url: string;
  /** Required for Qdrant Cloud; omit for a local/self-hosted instance. */
  apiKey?: string;
  /** Per-attempt timeout in ms before a request is treated as failed. Default 10000. */
  timeout?: number;
  /** Max retry attempts for transient errors. Default 3. */
  maxRetries?: number;
  /**
   * Overrides the provider's default batch chunk size (see
   * `vendorMaxBatchSize` on each provider). Raise this if your workload
   * benefits from fewer, larger upsert requests.
   */
  maxBatchSize?: number;
}

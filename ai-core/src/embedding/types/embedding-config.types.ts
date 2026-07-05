/**
 * Supported embedding vendors.
 *
 * Intentionally smaller than `LLMProviderName` from the LLM Provider Layer
 * (Component 1) — Groq, OpenRouter, and Anthropic do not expose a dedicated
 * embeddings endpoint today, so they are omitted here rather than stubbed
 * with a throwing implementation. Extend this union (and the schema/factory)
 * the day one of them ships an embeddings API.
 */
export type EmbeddingProviderName = 'openai' | 'gemini' | 'cohere' | 'ollama';

/**
 * Embedding models are trained asymmetrically: the vector for "the thing
 * being stored" and the vector for "the thing searching for it" are not
 * produced the same way. Several vendors (Cohere, Gemini) expose this as an
 * explicit request parameter, and retrieval quality suffers noticeably when
 * it's ignored — this is one of the most common silent bugs in hand-rolled
 * RAG pipelines. It's modeled here as a first-class concept so every call
 * site (Knowledge Chunking, RAG Retriever) has to make a conscious choice
 * rather than relying on a provider's default.
 */
export type EmbeddingInputType = 'document' | 'query' | 'clustering' | 'classification';

export interface EmbeddingConfig {
  provider: EmbeddingProviderName;
  /** Not required when provider === 'ollama'. */
  apiKey?: string;
  model: string;
  /** Override the vendor's default API base URL (self-hosted Ollama, TEI-compatible gateway, proxy, etc). */
  baseUrl?: string;
  /** Only honored by providers that support output truncation (OpenAI text-embedding-3-*, Gemini gemini-embedding-001). */
  dimensions?: number;
  /** Default 3. */
  maxRetries?: number;
  /** Default 30_000. */
  timeoutMs?: number;
  /** Caps (never raises) the provider's own vendor batch limit. */
  maxBatchSize?: number;
  /** Default 'document'. */
  defaultInputType?: EmbeddingInputType;
}

/**
 * Config after schema validation and default application — what providers
 * actually receive and store on `this.config`.
 */
export interface ResolvedEmbeddingConfig {
  provider: EmbeddingProviderName;
  apiKey?: string;
  model: string;
  baseUrl?: string;
  dimensions?: number;
  maxRetries: number;
  timeoutMs: number;
  maxBatchSize?: number;
  defaultInputType: EmbeddingInputType;
}

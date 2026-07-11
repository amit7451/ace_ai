export type RerankStrategyName = 'similarity-threshold' | 'mmr';

export interface RetrieverConfig {
  /** Vector store collection to search — see Component 3's multi-tenancy strategy notes for naming conventions. */
  collection: string;
  /** Default 5. */
  topK?: number;
  /**
   * Minimum relevance score a chunk must clear to be returned. Interpreted
   * relative to the collection's distance metric — higher-is-better for
   * cosine/dot, lower-is-better for euclid/manhattan (see README). Default 0.5.
   */
  scoreThreshold?: number;
  /** Default 'similarity-threshold'. */
  strategy?: RerankStrategyName;
  /** If set, trims the final chunk list (in rank order) to fit this many estimated tokens. */
  maxContextTokens?: number;
  /** 'mmr' strategy only: 0 = pure diversity, 1 = pure relevance. Default 0.5. */
  mmrLambda?: number;
}

/** Config after schema validation and default application — what `RagRetriever` actually stores on `this.config`. */
export interface ResolvedRetrieverConfig {
  collection: string;
  topK: number;
  scoreThreshold: number;
  strategy: RerankStrategyName;
  maxContextTokens?: number;
  mmrLambda: number;
}

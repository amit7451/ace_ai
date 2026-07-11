export interface EmbeddingVector {
  embedding: number[];
  /** Position of this vector relative to the original input array passed to embed()/embedBatch(). */
  index: number;
}

export interface EmbeddingUsage {
  promptTokens: number;
  totalTokens: number;
}

export interface EmbeddingResponse {
  embeddings: EmbeddingVector[];
  model: string;
  dimensions: number;
  usage: EmbeddingUsage;
}

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  text: string;
  score: number;
  sourceType: string;
  sourceUrl?: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export interface RetrievalResult {
  query: string;
  chunks: RetrievedChunk[];
  /**
   * True when at least one chunk cleared the relevance threshold. The
   * Prompt Builder (Component 6) is expected to use this to implement the
   * platform's core domain-restriction behavior (architecture doc, Product
   * Vision: politely decline out-of-domain questions instead of answering
   * from the LLM's general knowledge).
   */
  isRelevant: boolean;
  /** How many candidates came back from the vector search before reranking/threshold/dedup — useful for logging and threshold tuning. */
  totalCandidates: number;
  tookMs: number;
}

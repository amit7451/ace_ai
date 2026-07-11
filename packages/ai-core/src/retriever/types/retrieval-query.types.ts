import type { VectorFilter } from '../../vector-store/types/search.types';

export interface RetrievalQuery {
  query: string;
  tenantId: string;
  assistantId: string;
  /** Overrides RetrieverConfig.topK for this call only. */
  topK?: number;
  /** Overrides RetrieverConfig.scoreThreshold for this call only. */
  scoreThreshold?: number;
  /**
   * Additional filter conditions, ANDed with the tenantId/assistantId
   * isolation filter this retriever always applies on top (see README,
   * "Tenant isolation is not optional"). Use this to narrow further (e.g.
   * by sourceType) — it can never be used to relax tenant scoping.
   */
  filter?: VectorFilter;
  /** Overrides RetrieverConfig.maxContextTokens for this call only. */
  maxContextTokens?: number;
}

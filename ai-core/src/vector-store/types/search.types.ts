import { KnowledgeVectorPayload, VectorId } from './vector-record.types';

export type MatchValue = string | number | boolean;

/**
 * A single filter condition on a payload field. Deliberately small — it
 * covers exact-match and range queries, which is everything tenant
 * isolation and metadata filtering need. Anything fancier (geo, full-text)
 * can be added later without breaking this shape.
 */
export interface FilterCondition {
  key: string;
  match?: { value: MatchValue } | { any: MatchValue[] };
  range?: { gt?: number; gte?: number; lt?: number; lte?: number };
}

/**
 * Provider-agnostic filter DSL, translated by each provider into its own
 * query format (see `providers/qdrant/qdrant-filter.mapper.ts`). Modeled
 * directly on Qdrant's must/should/must_not clauses since that's the
 * closest thing to a lingua franca among vector DBs.
 */
export interface VectorFilter {
  must?: FilterCondition[];
  should?: FilterCondition[];
  mustNot?: FilterCondition[];
}

export interface VectorSearchQuery {
  vector: number[];
  /** Default 5. */
  topK?: number;
  filter?: VectorFilter;
  scoreThreshold?: number;
  /** Default true. */
  withPayload?: boolean;
  /** Default false. */
  withVector?: boolean;
}

export interface VectorSearchResult<TPayload = KnowledgeVectorPayload> {
  id: VectorId;
  score: number;
  payload?: TPayload;
  vector?: number[];
}

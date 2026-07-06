/**
 * Shapes of Qdrant's REST API request/response bodies. Internal to this
 * provider — nothing outside `providers/qdrant/` should import from here.
 * Confirmed against Qdrant's documented REST API (single, unnamed vector
 * mode; named/multi-vector collections are out of scope for this
 * component — see README "Known limitations").
 */

export interface QdrantVectorParams {
  size: number;
  distance: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan';
}

export interface QdrantCollectionInfoResult {
  status: string;
  points_count: number;
  config: {
    params: {
      vectors: QdrantVectorParams;
    };
  };
}

export interface QdrantCollectionInfoResponse {
  result: QdrantCollectionInfoResult;
}

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface QdrantScoredPoint {
  id: string | number;
  score: number;
  payload?: Record<string, unknown>;
  vector?: number[];
}

export interface QdrantSearchResponse {
  result: QdrantScoredPoint[];
}

export interface QdrantRetrieveResponse {
  result: QdrantPoint[];
}

export interface QdrantCountResponse {
  result: { count: number };
}

export interface QdrantUpsertResponse {
  result: { status: string };
}

export interface QdrantFilterCondition {
  key: string;
  match?: { value: string | number | boolean } | { any: (string | number | boolean)[] };
  range?: { gt?: number; gte?: number; lt?: number; lte?: number };
}

export interface QdrantFilter {
  must?: QdrantFilterCondition[];
  should?: QdrantFilterCondition[];
  must_not?: QdrantFilterCondition[];
}

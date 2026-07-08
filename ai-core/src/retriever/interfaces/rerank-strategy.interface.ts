import type { VectorSearchResult } from '../../vector-store/types/search.types';
import type { KnowledgeVectorPayload } from '../../vector-store/types/vector-record.types';
import type { DistanceMetric } from '../../vector-store/types/vector-store-config.types';
import type { RerankStrategyName } from '../types/retriever-config.types';

export interface RerankContext {
  queryVector: number[];
  scoreThreshold: number;
  topK: number;
  mmrLambda: number;
  distanceMetric: DistanceMetric;
}

/**
 * The pluggable axis of this component. Unlike Components 1-3 (one
 * interface, several *vendor* implementations), there's no third-party
 * vendor here — the two implementations are two different relevance
 * *philosophies* over the same candidate list, same shape as Component 4's
 * `IChunkingStrategy`.
 */
export interface IRerankStrategy {
  readonly name: RerankStrategyName;
  /** Whether this strategy needs candidate vectors (`withVector: true` on the search request) to do its job. */
  readonly requiresVectors: boolean;

  rerank<TPayload = KnowledgeVectorPayload>(
    candidates: VectorSearchResult<TPayload>[],
    context: RerankContext
  ): VectorSearchResult<TPayload>[];
}

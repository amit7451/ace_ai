import type { IRerankStrategy, RerankContext } from '../../interfaces/rerank-strategy.interface';
import type { VectorSearchResult } from '../../../vector-store/types/search.types';
import type { KnowledgeVectorPayload } from '../../../vector-store/types/vector-record.types';
import { filterByThreshold } from '../../utils/threshold-filter';

/**
 * The default, simplest strategy: keep everything that clears
 * `scoreThreshold`, sorted best-first, take the top K. No diversity
 * awareness — two near-duplicate-but-individually-relevant chunks can
 * both appear. See `MmrRerankStrategy` for a diversity-aware alternative.
 * Does not need candidate vectors, so it's also the cheapest — no
 * `withVector: true` round trip.
 */
export class SimilarityThresholdRerankStrategy implements IRerankStrategy {
  readonly name = 'similarity-threshold' as const;
  readonly requiresVectors = false;

  rerank<TPayload = KnowledgeVectorPayload>(
    candidates: VectorSearchResult<TPayload>[],
    context: RerankContext
  ): VectorSearchResult<TPayload>[] {
    const filtered = filterByThreshold(candidates, context.scoreThreshold, context.distanceMetric);
    return filtered.slice(0, context.topK);
  }
}

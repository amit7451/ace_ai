import type { VectorSearchResult } from '../../vector-store/types/search.types';
import type { DistanceMetric } from '../../vector-store/types/vector-store-config.types';

const LOWER_SCORE_IS_BETTER_METRICS: ReadonlySet<DistanceMetric> = new Set(['euclid', 'manhattan']);

/** Cosine and dot-product scores read "higher = more relevant"; euclidean/manhattan distances read the opposite. */
export function isLowerScoreBetter(distanceMetric: DistanceMetric): boolean {
  return LOWER_SCORE_IS_BETTER_METRICS.has(distanceMetric);
}

/**
 * Keeps only candidates that clear `scoreThreshold`, sorted best-first,
 * regardless of which direction the collection's distance metric reads in.
 * Shared by both rerank strategies so the "which direction is better"
 * logic lives in exactly one place.
 */
export function filterByThreshold<TPayload>(
  candidates: VectorSearchResult<TPayload>[],
  scoreThreshold: number,
  distanceMetric: DistanceMetric,
): VectorSearchResult<TPayload>[] {
  const lowerIsBetter = isLowerScoreBetter(distanceMetric);
  const passes = (score: number): boolean => (lowerIsBetter ? score <= scoreThreshold : score >= scoreThreshold);
  const filtered = candidates.filter((candidate) => passes(candidate.score));
  return [...filtered].sort((a, b) => (lowerIsBetter ? a.score - b.score : b.score - a.score));
}

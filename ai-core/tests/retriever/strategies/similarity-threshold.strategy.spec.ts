import { SimilarityThresholdRerankStrategy } from '../../../src/retriever/strategies/similarity-threshold/similarity-threshold-rerank.strategy';
import type { VectorSearchResult } from '../../../src/vector-store/types/search.types';
import type { RerankContext } from '../../../src/retriever/interfaces/rerank-strategy.interface';

function candidate(id: string, score: number): VectorSearchResult {
  return { id, score };
}

function context(overrides: Partial<RerankContext> = {}): RerankContext {
  return { queryVector: [1, 0], scoreThreshold: 0.5, topK: 5, mmrLambda: 0.5, distanceMetric: 'cosine', ...overrides };
}

describe('SimilarityThresholdRerankStrategy', () => {
  it('does not require candidate vectors', () => {
    const strategy = new SimilarityThresholdRerankStrategy();
    expect(strategy.requiresVectors).toBe(false);
    expect(strategy.name).toBe('similarity-threshold');
  });

  it('filters below-threshold candidates and sorts best-first', () => {
    const strategy = new SimilarityThresholdRerankStrategy();
    const candidates = [candidate('a', 0.3), candidate('b', 0.9), candidate('c', 0.6)];
    const result = strategy.rerank(candidates, context());
    expect(result.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('truncates to topK after filtering', () => {
    const strategy = new SimilarityThresholdRerankStrategy();
    const candidates = [candidate('a', 0.9), candidate('b', 0.8), candidate('c', 0.7), candidate('d', 0.6)];
    const result = strategy.rerank(candidates, context({ topK: 2 }));
    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('respects euclid distance direction (lower is better)', () => {
    const strategy = new SimilarityThresholdRerankStrategy();
    const candidates = [candidate('a', 2), candidate('b', 8), candidate('c', 5)];
    const result = strategy.rerank(candidates, context({ scoreThreshold: 6, distanceMetric: 'euclid' }));
    expect(result.map((r) => r.id)).toEqual(['a', 'c']);
  });
});

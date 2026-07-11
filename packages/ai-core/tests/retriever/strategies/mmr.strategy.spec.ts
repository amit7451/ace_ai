import { MmrRerankStrategy } from '../../../src/retriever/strategies/mmr/mmr-rerank.strategy';
import type { VectorSearchResult } from '../../../src/vector-store/types/search.types';
import type { RerankContext } from '../../../src/retriever/interfaces/rerank-strategy.interface';

function candidate(id: string, score: number, vector: number[]): VectorSearchResult {
  return { id, score, vector };
}

function context(overrides: Partial<RerankContext> = {}): RerankContext {
  return {
    queryVector: [1, 0],
    scoreThreshold: 0,
    topK: 2,
    mmrLambda: 0.5,
    distanceMetric: 'cosine',
    ...overrides,
  };
}

describe('MmrRerankStrategy', () => {
  it('declares that it requires candidate vectors', () => {
    const strategy = new MmrRerankStrategy();
    expect(strategy.requiresVectors).toBe(true);
    expect(strategy.name).toBe('mmr');
  });

  it('prefers a lower-scoring but diverse candidate over a higher-scoring near-duplicate', () => {
    const strategy = new MmrRerankStrategy();
    // A and B point in nearly the same direction (near-duplicate content);
    // C is orthogonal to A (genuinely different content, lower relevance).
    const candidates = [
      candidate('a', 0.99, [1, 0]),
      candidate('b', 0.98, [1, 0.01]),
      candidate('c', 0.5, [0, 1]),
    ];

    const result = strategy.rerank(candidates, context({ topK: 2, mmrLambda: 0.5 }));

    // Plain top-2-by-score would be [a, b] (both near-duplicates of the
    // same content); MMR should pick the diverse c instead of redundant b.
    expect(result.map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('degenerates to plain top-K-by-score when lambda = 1 (pure relevance, no diversity)', () => {
    const strategy = new MmrRerankStrategy();
    const candidates = [
      candidate('a', 0.99, [1, 0]),
      candidate('b', 0.98, [1, 0.01]),
      candidate('c', 0.5, [0, 1]),
    ];

    const result = strategy.rerank(candidates, context({ topK: 2, mmrLambda: 1 }));

    expect(result.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('applies the score threshold before diversity selection', () => {
    const strategy = new MmrRerankStrategy();
    const candidates = [candidate('a', 0.9, [1, 0]), candidate('b', 0.1, [0, 1])];
    const result = strategy.rerank(candidates, context({ scoreThreshold: 0.5, topK: 2 }));
    expect(result.map((r) => r.id)).toEqual(['a']);
  });

  it('drops candidates missing a vector rather than throwing', () => {
    const strategy = new MmrRerankStrategy();
    const candidates: VectorSearchResult[] = [candidate('a', 0.9, [1, 0]), { id: 'b', score: 0.8 }];
    const result = strategy.rerank(candidates, context({ topK: 2 }));
    expect(result.map((r) => r.id)).toEqual(['a']);
  });

  it('returns fewer than topK results when there are not enough eligible candidates', () => {
    const strategy = new MmrRerankStrategy();
    const candidates = [candidate('a', 0.9, [1, 0])];
    const result = strategy.rerank(candidates, context({ topK: 5 }));
    expect(result).toHaveLength(1);
  });
});

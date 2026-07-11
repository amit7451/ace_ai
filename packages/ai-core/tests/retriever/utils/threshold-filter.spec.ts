import {
  filterByThreshold,
  isLowerScoreBetter,
} from '../../../src/retriever/utils/threshold-filter';
import type { VectorSearchResult } from '../../../src/vector-store/types/search.types';

function candidate(id: string, score: number): VectorSearchResult {
  return { id, score };
}

describe('isLowerScoreBetter', () => {
  it('is false for cosine and dot (higher = more relevant)', () => {
    expect(isLowerScoreBetter('cosine')).toBe(false);
    expect(isLowerScoreBetter('dot')).toBe(false);
  });

  it('is true for euclid and manhattan (lower = more relevant)', () => {
    expect(isLowerScoreBetter('euclid')).toBe(true);
    expect(isLowerScoreBetter('manhattan')).toBe(true);
  });
});

describe('filterByThreshold', () => {
  it('keeps only candidates at or above the threshold for cosine, sorted best-first', () => {
    const candidates = [
      candidate('a', 0.4),
      candidate('b', 0.9),
      candidate('c', 0.6),
      candidate('d', 0.2),
    ];
    const result = filterByThreshold(candidates, 0.5, 'cosine');
    expect(result.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('keeps only candidates at or below the threshold for euclid, sorted best-first (ascending)', () => {
    const candidates = [
      candidate('a', 5),
      candidate('b', 1),
      candidate('c', 3),
      candidate('d', 10),
    ];
    const result = filterByThreshold(candidates, 4, 'euclid');
    expect(result.map((r) => r.id)).toEqual(['b', 'c']);
  });

  it('returns an empty array when nothing clears the threshold', () => {
    const candidates = [candidate('a', 0.1), candidate('b', 0.2)];
    expect(filterByThreshold(candidates, 0.9, 'cosine')).toEqual([]);
  });
});

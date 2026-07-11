import {
  cosineSimilarity,
  dotProduct,
  euclideanDistance,
  magnitude,
} from '../../../src/embedding/utils/similarity';

describe('similarity utils', () => {
  it('computes cosine similarity of 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('computes cosine similarity of 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('computes cosine similarity of -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for a zero-magnitude vector rather than dividing by zero', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });

  it('computes dot product correctly', () => {
    expect(dotProduct([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it('computes magnitude correctly', () => {
    expect(magnitude([3, 4])).toBeCloseTo(5);
  });

  it('computes euclidean distance correctly', () => {
    expect(euclideanDistance([0, 0], [3, 4])).toBeCloseTo(5);
  });

  it('throws on mismatched vector lengths', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow();
    expect(() => dotProduct([1], [1, 2])).toThrow();
    expect(() => euclideanDistance([1], [1, 2])).toThrow();
  });
});

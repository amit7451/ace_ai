import { chunkArray } from '../../../src/embedding/utils/batching';

describe('chunkArray', () => {
  it('splits an array into chunks of the given size', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when size >= array length', () => {
    expect(chunkArray([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it('returns an empty array for empty input', () => {
    expect(chunkArray([], 5)).toEqual([]);
  });

  it('throws for a non-positive size', () => {
    expect(() => chunkArray([1, 2, 3], 0)).toThrow();
    expect(() => chunkArray([1, 2, 3], -1)).toThrow();
  });

  it('throws for a non-integer size', () => {
    expect(() => chunkArray([1, 2, 3], 1.5)).toThrow();
  });
});

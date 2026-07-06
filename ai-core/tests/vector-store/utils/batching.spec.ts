import { chunkArray } from '../../../src/vector-store/utils/batching';

describe('chunkArray', () => {
  it('splits an array evenly when the length is a multiple of the chunk size', () => {
    expect(chunkArray([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('puts the remainder in a final, smaller chunk', () => {
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single chunk when size is larger than the array', () => {
    expect(chunkArray([1, 2], 10)).toEqual([[1, 2]]);
  });

  it('returns an empty array for empty input', () => {
    expect(chunkArray([], 5)).toEqual([]);
  });

  it('throws when size is zero or negative', () => {
    expect(() => chunkArray([1, 2, 3], 0)).toThrow('Chunk size must be greater than 0');
    expect(() => chunkArray([1, 2, 3], -1)).toThrow('Chunk size must be greater than 0');
  });
});

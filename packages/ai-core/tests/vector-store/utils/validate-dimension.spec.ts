import { validateVectorDimension } from '../../../src/vector-store/utils/validate-dimension';
import { VectorStoreDimensionMismatchError } from '../../../src/vector-store/errors/vector-store.errors';

describe('validateVectorDimension', () => {
  it('does not throw when the vector length matches', () => {
    expect(() => validateVectorDimension([1, 2, 3], 3, 'qdrant', 'test')).not.toThrow();
  });

  it('throws VectorStoreDimensionMismatchError with expected/received when lengths differ', () => {
    try {
      validateVectorDimension([1, 2], 3, 'qdrant', 'upsert into "docs"');
      throw new Error('expected validateVectorDimension to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(VectorStoreDimensionMismatchError);
      const dimensionError = error as VectorStoreDimensionMismatchError;
      expect(dimensionError.expected).toBe(3);
      expect(dimensionError.received).toBe(2);
      expect(dimensionError.message).toContain('upsert into "docs"');
      expect(dimensionError.retryable).toBe(false);
    }
  });
});

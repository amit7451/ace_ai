import { VectorStoreDimensionMismatchError } from '../errors/vector-store.errors';

/**
 * Throws `VectorStoreDimensionMismatchError` if `vector` doesn't match
 * `expectedSize`. Called before every upsert and search so a stale
 * embedding model, a wrong collection name, or a silent model swap fails
 * immediately and clearly — instead of corrupting search quality or
 * surfacing as an opaque Qdrant 400 error.
 */
export function validateVectorDimension(
  vector: number[],
  expectedSize: number,
  provider: string,
  context: string
): void {
  if (vector.length !== expectedSize) {
    throw new VectorStoreDimensionMismatchError(
      `Vector dimension mismatch in ${context}: collection expects ${expectedSize}, received ${vector.length}. ` +
        'This usually means the embedding model changed without updating the collection, or the wrong collection was targeted.',
      expectedSize,
      vector.length,
      { provider }
    );
  }
}

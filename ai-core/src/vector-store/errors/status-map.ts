import {
  VectorStoreAlreadyExistsError,
  VectorStoreAuthenticationError,
  VectorStoreError,
  VectorStoreInvalidRequestError,
  VectorStoreNotFoundError,
  VectorStoreProviderUnavailableError,
  VectorStoreTimeoutError,
} from './vector-store.errors';

/**
 * Maps a Qdrant HTTP status code onto the normalized error hierarchy.
 * Kept separate from any single provider's file since a future
 * REST-based provider (Pinecone, Weaviate) is likely to reuse the same
 * status-code conventions.
 */
export function mapHttpStatusToError(
  status: number,
  message: string,
  provider: string,
  cause?: unknown
): VectorStoreError {
  if (status === 401 || status === 403) {
    return new VectorStoreAuthenticationError(message, { provider, statusCode: status, cause });
  }
  if (status === 404) {
    return new VectorStoreNotFoundError(message, { provider, statusCode: status, cause });
  }
  if (status === 409) {
    return new VectorStoreAlreadyExistsError(message, { provider, statusCode: status, cause });
  }
  if (status === 400 || status === 422) {
    return new VectorStoreInvalidRequestError(message, { provider, statusCode: status, cause });
  }
  if (status === 408) {
    return new VectorStoreTimeoutError(message, { provider, statusCode: status, cause });
  }
  if (status >= 500) {
    return new VectorStoreProviderUnavailableError(message, { provider, statusCode: status, cause });
  }
  return new VectorStoreError(message, 'UNKNOWN_ERROR', { provider, statusCode: status, retryable: false, cause });
}

/** Only `VectorStoreError`s that self-report as retryable are retried; anything else (a bug, an unexpected throw) fails fast. */
export function isRetryableError(error: unknown): boolean {
  return error instanceof VectorStoreError && error.retryable;
}

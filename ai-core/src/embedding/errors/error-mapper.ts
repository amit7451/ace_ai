import {
  EmbeddingAuthenticationError,
  EmbeddingError,
  EmbeddingInvalidRequestError,
  EmbeddingProviderUnavailableError,
  EmbeddingRateLimitError,
  EmbeddingTimeoutError,
} from './embedding.errors';

/** Normalizes any vendor's HTTP error response into the shared error hierarchy. */
export function mapHttpStatusToEmbeddingError(
  provider: string,
  status: number,
  bodyText: string,
  retryAfterMs?: number,
): EmbeddingError {
  switch (true) {
    case status === 401 || status === 403:
      return new EmbeddingAuthenticationError(provider, bodyText);
    case status === 429:
      return new EmbeddingRateLimitError(provider, retryAfterMs, bodyText);
    case status === 400 || status === 422:
      return new EmbeddingInvalidRequestError(bodyText || `Invalid request to embedding provider "${provider}".`, provider);
    case status >= 500:
      return new EmbeddingProviderUnavailableError(provider, status, bodyText);
    default:
      return new EmbeddingError(`Unexpected response (${status}) from embedding provider "${provider}": ${bodyText}`, provider, status);
  }
}

/**
 * Only transient errors are retried (rate limits, timeouts, 5xx) — same
 * policy as the LLM Provider Layer. Authentication and validation errors
 * fail fast since retrying them can never succeed.
 */
export function isRetryableEmbeddingError(err: unknown): boolean {
  return err instanceof EmbeddingRateLimitError || err instanceof EmbeddingProviderUnavailableError || err instanceof EmbeddingTimeoutError;
}

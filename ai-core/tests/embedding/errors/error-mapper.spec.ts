import { isRetryableEmbeddingError, mapHttpStatusToEmbeddingError } from '../../../src/embedding/errors/error-mapper';
import {
  EmbeddingAuthenticationError,
  EmbeddingInvalidRequestError,
  EmbeddingProviderUnavailableError,
  EmbeddingRateLimitError,
} from '../../../src/embedding/errors/embedding.errors';

describe('mapHttpStatusToEmbeddingError', () => {
  it('maps 401 and 403 to EmbeddingAuthenticationError', () => {
    expect(mapHttpStatusToEmbeddingError('openai', 401, '')).toBeInstanceOf(EmbeddingAuthenticationError);
    expect(mapHttpStatusToEmbeddingError('openai', 403, '')).toBeInstanceOf(EmbeddingAuthenticationError);
  });

  it('maps 429 to EmbeddingRateLimitError and carries retryAfterMs', () => {
    const err = mapHttpStatusToEmbeddingError('cohere', 429, '', 5000) as EmbeddingRateLimitError;
    expect(err).toBeInstanceOf(EmbeddingRateLimitError);
    expect(err.retryAfterMs).toBe(5000);
  });

  it('maps 400 and 422 to EmbeddingInvalidRequestError', () => {
    expect(mapHttpStatusToEmbeddingError('gemini', 400, 'bad request')).toBeInstanceOf(EmbeddingInvalidRequestError);
    expect(mapHttpStatusToEmbeddingError('gemini', 422, 'bad request')).toBeInstanceOf(EmbeddingInvalidRequestError);
  });

  it('maps 5xx to EmbeddingProviderUnavailableError', () => {
    expect(mapHttpStatusToEmbeddingError('ollama', 503, '')).toBeInstanceOf(EmbeddingProviderUnavailableError);
  });
});

describe('isRetryableEmbeddingError', () => {
  it('marks rate limit and unavailable errors as retryable', () => {
    expect(isRetryableEmbeddingError(new EmbeddingRateLimitError('openai'))).toBe(true);
    expect(isRetryableEmbeddingError(new EmbeddingProviderUnavailableError('openai'))).toBe(true);
  });

  it('marks authentication and validation errors as non-retryable', () => {
    expect(isRetryableEmbeddingError(new EmbeddingAuthenticationError('openai'))).toBe(false);
    expect(isRetryableEmbeddingError(new EmbeddingInvalidRequestError('bad', 'openai'))).toBe(false);
  });
});

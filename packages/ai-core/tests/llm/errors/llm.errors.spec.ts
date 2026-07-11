import {
  LLMAuthenticationError,
  LLMRateLimitError,
  LLMTimeoutError,
  LLMInvalidRequestError,
  LLMProviderUnavailableError,
  LLMContextLengthError,
  LLMUnknownError,
  mapHttpStatusToError,
  mapHttpErrorResponse,
} from '../../../src/llm/errors/llm.errors';

describe('LLM error classes', () => {
  it('carries provider/model/statusCode context on the base fields', () => {
    const error = new LLMTimeoutError({
      provider: 'openai',
      model: 'gpt-4o-mini',
      statusCode: 408,
    });
    expect(error.provider).toBe('openai');
    expect(error.model).toBe('gpt-4o-mini');
    expect(error.statusCode).toBe(408);
    expect(error.code).toBe('TIMEOUT_ERROR');
    expect(error).toBeInstanceOf(Error);
  });

  it('LLMRateLimitError exposes an optional retryAfterMs', () => {
    const error = new LLMRateLimitError({ provider: 'openai', retryAfterMs: 2000 });
    expect(error.retryAfterMs).toBe(2000);
    expect(error.code).toBe('RATE_LIMIT_ERROR');
  });

  it('LLMInvalidRequestError preserves the custom message', () => {
    const error = new LLMInvalidRequestError('bad payload', { provider: 'ollama' });
    expect(error.message).toBe('bad payload');
    expect(error.code).toBe('INVALID_REQUEST_ERROR');
  });

  it('LLMProviderUnavailableError and LLMContextLengthError set the expected codes', () => {
    expect(new LLMProviderUnavailableError({ provider: 'gemini' }).code).toBe(
      'PROVIDER_UNAVAILABLE_ERROR'
    );
    expect(new LLMContextLengthError({ provider: 'anthropic' }).code).toBe('CONTEXT_LENGTH_ERROR');
  });

  it('LLMUnknownError carries a custom message and UNKNOWN_ERROR code', () => {
    const error = new LLMUnknownError('something odd happened', { provider: 'groq' });
    expect(error.message).toBe('something odd happened');
    expect(error.code).toBe('UNKNOWN_ERROR');
  });

  it('LLMAuthenticationError instances are all still LLMError instances', () => {
    const error = new LLMAuthenticationError({ provider: 'openai' });
    expect(error.name).toBe('LLMAuthenticationError');
  });
});

describe('mapHttpStatusToError', () => {
  it.each([
    [401, 'AUTHENTICATION_ERROR'],
    [403, 'AUTHENTICATION_ERROR'],
    [408, 'TIMEOUT_ERROR'],
    [429, 'RATE_LIMIT_ERROR'],
    [400, 'INVALID_REQUEST_ERROR'],
    [404, 'INVALID_REQUEST_ERROR'],
    [422, 'INVALID_REQUEST_ERROR'],
    [500, 'PROVIDER_UNAVAILABLE_ERROR'],
    [502, 'PROVIDER_UNAVAILABLE_ERROR'],
    [503, 'PROVIDER_UNAVAILABLE_ERROR'],
    [504, 'PROVIDER_UNAVAILABLE_ERROR'],
    [418, 'UNKNOWN_ERROR'],
  ])('maps HTTP %i to %s', (status, expectedCode) => {
    const error = mapHttpStatusToError(status, 'openai', 'some message', 'gpt-4o-mini');
    expect(error.code).toBe(expectedCode);
    expect(error.statusCode).toBe(status);
  });

  it('falls back to a generic message when none is provided', () => {
    const error = mapHttpStatusToError(500, 'openai', '');
    expect(error.message).toContain('openai');
  });
});

describe('mapHttpErrorResponse', () => {
  it('reads the response body and maps it based on status', async () => {
    const response = { status: 429, text: async () => 'slow down' };
    const error = await mapHttpErrorResponse(response, 'groq', 'llama-3.3-70b-versatile');
    expect(error.code).toBe('RATE_LIMIT_ERROR');
    expect(error.model).toBe('llama-3.3-70b-versatile');
  });
});

export type LLMErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'TIMEOUT_ERROR'
  | 'INVALID_REQUEST_ERROR'
  | 'PROVIDER_UNAVAILABLE_ERROR'
  | 'CONTEXT_LENGTH_ERROR'
  | 'UNKNOWN_ERROR';

export interface LLMErrorContext {
  provider: string;
  model?: string;
  statusCode?: number;
  cause?: unknown;
}

export class LLMError extends Error {
  readonly code: LLMErrorCode;
  readonly provider: string;
  readonly model?: string;
  readonly statusCode?: number;
  readonly cause?: unknown;

  constructor(message: string, code: LLMErrorCode, context: LLMErrorContext) {
    super(message);
    this.name = 'LLMError';
    this.code = code;
    this.provider = context.provider;
    this.model = context.model;
    this.statusCode = context.statusCode;
    this.cause = context.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class LLMAuthenticationError extends LLMError {
  constructor(context: LLMErrorContext) {
    super(
      `Authentication failed for provider "${context.provider}". Check the configured API key.`,
      'AUTHENTICATION_ERROR',
      context
    );
    this.name = 'LLMAuthenticationError';
  }
}

export class LLMRateLimitError extends LLMError {
  readonly retryAfterMs?: number;

  constructor(context: LLMErrorContext & { retryAfterMs?: number }) {
    super(`Rate limit exceeded for provider "${context.provider}".`, 'RATE_LIMIT_ERROR', context);
    this.name = 'LLMRateLimitError';
    this.retryAfterMs = context.retryAfterMs;
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(context: LLMErrorContext) {
    super(`Request to provider "${context.provider}" timed out.`, 'TIMEOUT_ERROR', context);
    this.name = 'LLMTimeoutError';
  }
}

export class LLMInvalidRequestError extends LLMError {
  constructor(message: string, context: LLMErrorContext) {
    super(message, 'INVALID_REQUEST_ERROR', context);
    this.name = 'LLMInvalidRequestError';
  }
}

export class LLMProviderUnavailableError extends LLMError {
  constructor(context: LLMErrorContext) {
    super(
      `Provider "${context.provider}" is currently unavailable. Please retry shortly.`,
      'PROVIDER_UNAVAILABLE_ERROR',
      context
    );
    this.name = 'LLMProviderUnavailableError';
  }
}

export class LLMContextLengthError extends LLMError {
  constructor(context: LLMErrorContext) {
    super(
      `Request to provider "${context.provider}" exceeded the model's maximum context length.`,
      'CONTEXT_LENGTH_ERROR',
      context
    );
    this.name = 'LLMContextLengthError';
  }
}

export class LLMUnknownError extends LLMError {
  constructor(message: string, context: LLMErrorContext) {
    super(message, 'UNKNOWN_ERROR', context);
    this.name = 'LLMUnknownError';
  }
}

export function mapHttpStatusToError(
  status: number,
  provider: string,
  message: string,
  model?: string
): LLMError {
  switch (status) {
    case 401:
    case 403:
      return new LLMAuthenticationError({ provider, model, statusCode: status });
    case 408:
      return new LLMTimeoutError({ provider, model, statusCode: status });
    case 429:
      return new LLMRateLimitError({ provider, model, statusCode: status });
    case 400:
    case 404:
    case 422:
      return new LLMInvalidRequestError(
        message || `Invalid request sent to provider "${provider}".`,
        {
          provider,
          model,
          statusCode: status,
        }
      );
    case 500:
    case 502:
    case 503:
    case 504:
      return new LLMProviderUnavailableError({ provider, model, statusCode: status });
    default:
      return new LLMUnknownError(message || `Unexpected error from provider "${provider}".`, {
        provider,
        model,
        statusCode: status,
      });
  }
}

export interface HttpErrorLike {
  status: number;
  text(): Promise<string>;
}

export async function mapHttpErrorResponse(
  response: HttpErrorLike,
  provider: string,
  model?: string
): Promise<LLMError> {
  const body = await response.text();
  return mapHttpStatusToError(response.status, provider, body, model);
}

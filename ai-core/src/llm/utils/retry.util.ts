import { LLMRateLimitError, LLMTimeoutError, LLMProviderUnavailableError } from '../errors/llm.errors';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const defaultIsRetryable = (error: unknown): boolean => {
  return error instanceof LLMRateLimitError || error instanceof LLMTimeoutError || error instanceof LLMProviderUnavailableError;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes `fn`, retrying on transient failures with exponential backoff
 * and jitter. Only errors matched by `isRetryable` (defaults to rate-limit,
 * timeout, and provider-unavailable errors) trigger a retry; everything
 * else is thrown immediately.
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxRetries, baseDelayMs = 500, maxDelayMs = 15_000, isRetryable = defaultIsRetryable, onRetry } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt || !isRetryable(error)) {
        throw error;
      }

      const jitter = 0.85 + Math.random() * 0.3;
      const delayMs = Math.min(baseDelayMs * 2 ** attempt * jitter, maxDelayMs);
      onRetry?.(attempt + 1, error, delayMs);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

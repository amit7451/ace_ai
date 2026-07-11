import { isRetryableError } from '../errors/status-map';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Exponential backoff with jitter. Only errors that self-report as
 * retryable (see `isRetryableError`) trigger another attempt —
 * authentication and validation errors fail on the first try. Identical
 * policy to Component 1 (LLM) and Component 2 (Embedding).
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxRetries, baseDelayMs = 250, maxDelayMs = 8000 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const canRetry = attempt < maxRetries && isRetryableError(error);
      if (!canRetry) {
        throw error;
      }
      const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = Math.random() * exponential * 0.5;
      await sleep(exponential / 2 + jitter);
    }
  }

  // Unreachable in practice (the loop always returns or throws), but keeps
  // TypeScript's control-flow analysis happy without a non-null assertion.
  throw lastError;
}

/** Races `promise` against a timeout, rejecting with `onTimeout()`'s error if the timeout wins. */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error
): Promise<T> {
  let timer!: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

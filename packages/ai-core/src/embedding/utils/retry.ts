export interface RetryOptions {
  maxRetries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

function jitteredDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exp = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
  return Math.floor(exp / 2 + Math.random() * (exp / 2));
}

/**
 * Exponential backoff with jitter, matching the LLM Provider Layer's
 * `retryWithBackoff`. Only errors passing `isRetryable` are retried;
 * everything else (auth, validation) is rethrown on the first attempt.
 *
 * Wraps the *initial* request only — same known limitation as Component 1:
 * there's nothing mid-flight to retry for a single embeddings HTTP call, so
 * this is simpler than the streaming case, not a gap.
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const {
    maxRetries,
    baseDelayMs = 300,
    maxDelayMs = 65000,
    isRetryable = () => true,
    onRetry,
  } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === maxRetries;
      if (isLastAttempt || !isRetryable(err)) {
        throw err;
      }
      let delayMs = jitteredDelay(attempt, baseDelayMs, maxDelayMs);
      if (
        err &&
        typeof err === 'object' &&
        'retryAfterMs' in err &&
        typeof (err as any).retryAfterMs === 'number' &&
        (err as any).retryAfterMs > 0
      ) {
        // Add a 500ms safety buffer to ensure remote quota has reset
        delayMs = Math.min((err as any).retryAfterMs + 500, maxDelayMs);
      }
      onRetry?.(err, attempt + 1, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

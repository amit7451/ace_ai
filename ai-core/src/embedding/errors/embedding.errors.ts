/**
 * Base of the normalized error hierarchy. Every provider maps its own error
 * shape onto one of these subclasses, so upstream code (the future AI
 * Orchestrator, Component 8) never has to branch on vendor-specific error
 * formats — same principle as `LLMError` in the LLM Provider Layer.
 */
export class EmbeddingError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'EmbeddingError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class EmbeddingAuthenticationError extends EmbeddingError {
  constructor(provider: string, cause?: unknown) {
    super(`Authentication failed for embedding provider "${provider}". Check the configured API key.`, provider, 401, cause);
    this.name = 'EmbeddingAuthenticationError';
  }
}

export class EmbeddingRateLimitError extends EmbeddingError {
  constructor(
    provider: string,
    public readonly retryAfterMs?: number,
    cause?: unknown,
  ) {
    super(`Rate limit exceeded for embedding provider "${provider}".`, provider, 429, cause);
    this.name = 'EmbeddingRateLimitError';
  }
}

export class EmbeddingTimeoutError extends EmbeddingError {
  constructor(provider: string, timeoutMs: number, cause?: unknown) {
    super(`Embedding request to "${provider}" timed out after ${timeoutMs}ms.`, provider, undefined, cause);
    this.name = 'EmbeddingTimeoutError';
  }
}

export class EmbeddingInvalidRequestError extends EmbeddingError {
  constructor(message: string, provider: string, cause?: unknown) {
    super(message, provider, 400, cause);
    this.name = 'EmbeddingInvalidRequestError';
  }
}

export class EmbeddingProviderUnavailableError extends EmbeddingError {
  constructor(provider: string, statusCode?: number, cause?: unknown) {
    super(`Embedding provider "${provider}" is unavailable.`, provider, statusCode, cause);
    this.name = 'EmbeddingProviderUnavailableError';
  }
}

/**
 * Unique to the embedding layer (no LLM equivalent): a vector database
 * collection is built around one fixed dimensionality. If a model or
 * `dimensions` override changes after vectors already exist — a stale env
 * var, a swapped model name — new vectors silently corrupt search quality
 * instead of throwing, unless something checks. This is that check.
 */
export class EmbeddingDimensionMismatchError extends EmbeddingError {
  constructor(
    provider: string,
    public readonly expected: number,
    public readonly received: number,
    model: string,
  ) {
    super(
      `Embedding dimension mismatch for "${provider}" model "${model}": expected ${expected}, got ${received}. ` +
        'This usually means the model or "dimensions" config changed after a vector collection was already ' +
        'created — re-index the knowledge base or pin the previous model/config.',
      provider,
      undefined,
    );
    this.name = 'EmbeddingDimensionMismatchError';
  }
}

export class EmbeddingBatchSizeError extends EmbeddingError {
  constructor(
    provider: string,
    public readonly maxBatchSize: number,
    public readonly received: number,
  ) {
    super(`Batch of ${received} inputs exceeds "${provider}"'s configured max batch size of ${maxBatchSize}.`, provider, 400);
    this.name = 'EmbeddingBatchSizeError';
  }
}

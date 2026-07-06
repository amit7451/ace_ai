export type VectorStoreErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'CONNECTION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'DIMENSION_MISMATCH'
  | 'PROVIDER_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

export interface VectorStoreErrorOptions {
  provider: string;
  statusCode?: number;
  retryable?: boolean;
  cause?: unknown;
}

/**
 * Base of the normalized error hierarchy. Every provider maps its own
 * error shape onto one of these subclasses so calling code (Components 4
 * and 5) never has to know whether it's talking to Qdrant, Pinecone, or
 * anything else added later — same normalization Component 2 does for
 * embedding providers.
 */
export class VectorStoreError extends Error {
  readonly code: VectorStoreErrorCode;
  readonly provider: string;
  readonly statusCode?: number;
  readonly retryable: boolean;
  readonly cause?: unknown;

  constructor(message: string, code: VectorStoreErrorCode, options: VectorStoreErrorOptions) {
    super(message);
    this.name = 'VectorStoreError';
    this.code = code;
    this.provider = options.provider;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    this.cause = options.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Bad or missing API key. Never retried. */
export class VectorStoreAuthenticationError extends VectorStoreError {
  constructor(message: string, options: VectorStoreErrorOptions) {
    super(message, 'AUTHENTICATION_ERROR', { ...options, retryable: false });
    this.name = 'VectorStoreAuthenticationError';
  }
}

/** Couldn't reach the vector store at all (network failure, DNS, ECONNREFUSED). Retried. */
export class VectorStoreConnectionError extends VectorStoreError {
  constructor(message: string, options: VectorStoreErrorOptions) {
    super(message, 'CONNECTION_ERROR', { ...options, retryable: true });
    this.name = 'VectorStoreConnectionError';
  }
}

/** A single attempt exceeded its configured timeout. Retried. */
export class VectorStoreTimeoutError extends VectorStoreError {
  constructor(message: string, options: VectorStoreErrorOptions) {
    super(message, 'TIMEOUT_ERROR', { ...options, retryable: true });
    this.name = 'VectorStoreTimeoutError';
  }
}

/** Malformed request (bad filter, bad payload shape, invalid collection name, etc). Never retried — retrying an invalid request just repeats the failure. */
export class VectorStoreInvalidRequestError extends VectorStoreError {
  constructor(message: string, options: VectorStoreErrorOptions) {
    super(message, 'INVALID_REQUEST', { ...options, retryable: false });
    this.name = 'VectorStoreInvalidRequestError';
  }
}

/** Collection or point does not exist. Never retried. */
export class VectorStoreNotFoundError extends VectorStoreError {
  constructor(message: string, options: VectorStoreErrorOptions) {
    super(message, 'NOT_FOUND', { ...options, retryable: false });
    this.name = 'VectorStoreNotFoundError';
  }
}

/** Collection already exists (on a non-idempotent create, or a dimension mismatch inside `getOrCreateCollection`). Never retried. */
export class VectorStoreAlreadyExistsError extends VectorStoreError {
  constructor(message: string, options: VectorStoreErrorOptions) {
    super(message, 'ALREADY_EXISTS', { ...options, retryable: false });
    this.name = 'VectorStoreAlreadyExistsError';
  }
}

/**
 * Thrown whenever a vector's length disagrees with its collection's
 * configured dimensionality — the write-side counterpart to Component 2's
 * `EmbeddingDimensionMismatchError`. Checked client-side before the
 * request is ever sent, so this fails fast and clearly instead of as an
 * opaque 400 from Qdrant three layers away from the actual mistake
 * (usually: an embedding model was swapped without a matching new
 * collection).
 */
export class VectorStoreDimensionMismatchError extends VectorStoreError {
  readonly expected: number;
  readonly received: number;

  constructor(message: string, expected: number, received: number, options: VectorStoreErrorOptions) {
    super(message, 'DIMENSION_MISMATCH', { ...options, retryable: false });
    this.name = 'VectorStoreDimensionMismatchError';
    this.expected = expected;
    this.received = received;
  }
}

/** 5xx / service-down responses. Retried. */
export class VectorStoreProviderUnavailableError extends VectorStoreError {
  constructor(message: string, options: VectorStoreErrorOptions) {
    super(message, 'PROVIDER_UNAVAILABLE', { ...options, retryable: true });
    this.name = 'VectorStoreProviderUnavailableError';
  }
}

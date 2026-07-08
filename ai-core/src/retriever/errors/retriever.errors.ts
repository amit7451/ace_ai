/**
 * Base of this component's error hierarchy. Like Component 4, most of
 * this layer's real work is composition over Components 2 and 3, whose
 * own `EmbeddingError`/`VectorStoreError` hierarchies already normalize
 * their respective HTTP failures — those are allowed to bubble up as-is
 * rather than being re-wrapped here. This hierarchy only covers failure
 * modes genuinely specific to retrieval itself.
 */
export class RetrieverError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'RetrieverError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown on the first `retrieve()` call against a given collection if the
 * embedding provider's `dimensions` doesn't match the collection's
 * `vectorSize`. The write-side equivalent
 * (`EmbeddingDimensionMismatchError` / `VectorStoreDimensionMismatchError`)
 * already exists in Components 2/3; this is the read-side check, catching
 * "the embedding model was swapped but the knowledge base wasn't
 * re-indexed" immediately and clearly instead of silently returning
 * garbage nearest-neighbor results or an opaque vendor error.
 */
export class RetrieverDimensionMismatchError extends RetrieverError {
  constructor(
    public readonly collection: string,
    public readonly expected: number,
    public readonly received: number,
    model: string,
  ) {
    super(
      `Vector store collection "${collection}" expects ${expected}-dimension vectors, but embedding ` +
        `model "${model}" produces ${received}-dimension vectors. This usually means the embedding ` +
        'model (or a "dimensions" override) changed after the knowledge base was indexed — re-index ' +
        'it against the new model, or point this retriever at the correct collection.',
    );
    this.name = 'RetrieverDimensionMismatchError';
  }
}

export class RetrieverUnsupportedStrategyError extends RetrieverError {
  constructor(public readonly strategy: string) {
    super(`Unsupported rerank strategy: "${strategy}".`);
    this.name = 'RetrieverUnsupportedStrategyError';
  }
}

/**
 * Base of this component's error hierarchy. Unlike Components 1-3, nothing
 * here makes a network call, so there's no HTTP-status mapping or
 * retry/backoff — the equivalent discipline in a pure-computation layer is
 * failing fast and specifically on bad input/config, which is what these
 * subclasses are for.
 */
export class KnowledgeError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'KnowledgeError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class KnowledgeUnsupportedFormatError extends KnowledgeError {
  constructor(format: string) {
    super(`Unsupported document format: "${format}".`);
    this.name = 'KnowledgeUnsupportedFormatError';
  }
}

export class KnowledgeUnsupportedStrategyError extends KnowledgeError {
  constructor(strategy: string) {
    super(`Unsupported chunking strategy: "${strategy}".`);
    this.name = 'KnowledgeUnsupportedStrategyError';
  }
}

export class KnowledgeInvalidConfigError extends KnowledgeError {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeInvalidConfigError';
  }
}

export class KnowledgeParsingError extends KnowledgeError {
  constructor(format: string, message: string, cause?: unknown) {
    super(`Failed to parse "${format}" document: ${message}`, cause);
    this.name = 'KnowledgeParsingError';
  }
}

/**
 * Thrown both when raw input is empty/whitespace-only before parsing, and
 * when a chunking strategy legitimately produces zero non-empty chunks
 * (e.g. a markdown file containing only headers with no body text).
 */
export class KnowledgeEmptyContentError extends KnowledgeError {
  constructor(format: string) {
    super(
      `Document content for format "${format}" was empty after parsing/cleaning — nothing to chunk.`
    );
    this.name = 'KnowledgeEmptyContentError';
  }
}

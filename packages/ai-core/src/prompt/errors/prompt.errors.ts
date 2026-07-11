/**
 * Domain-specific error hierarchy for Component 6.
 *
 * Every error thrown by the Prompt Builder layer extends
 * `PromptBuilderError`, so callers can catch the whole family with a
 * single `catch (e) { if (e instanceof PromptBuilderError) … }`.
 *
 * The hierarchy mirrors the pattern established by Component 1's
 * `LLMProviderError`, Component 2's `EmbeddingProviderError`, etc.
 */

// ────────────────────────────────────────────────────────────────────
// Base
// ────────────────────────────────────────────────────────────────────

export class PromptBuilderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'PromptBuilderError';
  }
}

// ────────────────────────────────────────────────────────────────────
// Domain guardrail violation
// ────────────────────────────────────────────────────────────────────

/**
 * Thrown when `fallbackStrategy === 'throw_error'` and the retriever
 * reports `isRelevant === false`.  The Orchestrator (Component 8) is
 * expected to catch this and return a hard-coded refusal message,
 * saving LLM tokens entirely.
 */
export class OutOfDomainError extends PromptBuilderError {
  constructor(public readonly query: string) {
    super(`Domain guardrail triggered — no relevant knowledge found for query: "${query}".`);
    this.name = 'OutOfDomainError';
  }
}

// ────────────────────────────────────────────────────────────────────
// Template rendering
// ────────────────────────────────────────────────────────────────────

/**
 * Thrown when a `contextTemplate` references a variable placeholder
 * (e.g. `{context}`) that could not be resolved — usually a
 * misconfiguration caught at build-prompt time rather than at
 * construction time.
 */
export class PromptTemplateError extends PromptBuilderError {
  constructor(
    public readonly template: string,
    public readonly missingVariable: string
  ) {
    super(
      `Prompt template is missing required variable "{${missingVariable}}" — ` +
        `template: "${template.slice(0, 80)}…"`
    );
    this.name = 'PromptTemplateError';
  }
}

// ────────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────────

/**
 * Thrown when a `PromptRequest` fails Zod validation — e.g. an empty
 * query string or a missing retrieval result.
 */
export class PromptValidationError extends PromptBuilderError {
  constructor(
    message: string,
    public readonly validationErrors?: unknown
  ) {
    super(message);
    this.name = 'PromptValidationError';
  }
}

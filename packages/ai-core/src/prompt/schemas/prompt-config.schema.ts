import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────
// Fallback strategy enum
// ────────────────────────────────────────────────────────────────────

/**
 * Controls what happens when `RetrievalResult.isRelevant` is `false`:
 *
 * - `'instruct_llm'` — Append the `fallbackInstruction` to the system
 *   prompt so the LLM produces a natural-language refusal in the
 *   assistant's persona. Costs one LLM call but preserves the
 *   conversational tone.
 *
 * - `'throw_error'` — Throw an `OutOfDomainError` immediately so the
 *   Orchestrator (Component 8) can return a hard-coded fallback
 *   message without spending any LLM tokens.
 */
export const FALLBACK_STRATEGIES = ['instruct_llm', 'throw_error'] as const;
export const fallbackStrategySchema = z.enum(FALLBACK_STRATEGIES);

// ────────────────────────────────────────────────────────────────────
// LLMMessage schema (structural mirror of Component 1's type)
// ────────────────────────────────────────────────────────────────────

/**
 * Validates each `LLMMessage` in the conversation history. This is
 * the first layer where history arrives from external callers (API
 * boundary), so we apply structural validation here rather than
 * relying on TypeScript-only guarantees.
 */
export const llmMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
});

// ────────────────────────────────────────────────────────────────────
// Prompt config schema
// ────────────────────────────────────────────────────────────────────

/** Validates `PromptConfig` at `RagPromptBuilder` construction time. */
export const promptConfigSchema = z.object({
  /**
   * The base persona / system-level instructions for the assistant.
   * This is always the very first message in the assembled prompt.
   *
   * @example "You are a helpful customer-support agent for ACME Corp.
   *           Answer only from the provided context."
   */
  systemPrompt: z.string().min(1, 'systemPrompt is required'),

  /**
   * The instruction appended to the system prompt when the retriever
   * reports `isRelevant === false` and `fallbackStrategy` is
   * `'instruct_llm'`.
   */
  fallbackInstruction: z
    .string()
    .default(
      'The provided context does not contain information relevant to this query. ' +
        'Politely inform the user that this question is outside your area of expertise ' +
        'and suggest they contact the appropriate department.'
    ),

  /**
   * Template string for rendering retrieved chunks into the system
   * prompt. Must contain the `{context}` placeholder; an error is
   * thrown at build time if it is missing.
   *
   * @example "Use the following verified information to answer:\n\n{context}"
   */
  contextTemplate: z
    .string()
    .default(
      "Use the following verified information to answer the user's question.\n" +
        'If the answer is not contained in the context, say so — do not guess.\n\n' +
        '---\n{context}\n---'
    ),

  /** @see fallbackStrategySchema */
  fallbackStrategy: fallbackStrategySchema.default('instruct_llm'),

  /**
   * Maximum number of history messages (from Component 7) to include
   * in the assembled prompt. Older messages are silently dropped to
   * respect LLM context-window budgets. `undefined` means "include
   * all history" — the caller is responsible for pre-trimming.
   */
  maxHistoryMessages: z.number().int().positive().optional(),
});

// ────────────────────────────────────────────────────────────────────
// Prompt request schema
// ────────────────────────────────────────────────────────────────────

/** Validates every `PromptRequest` on each `buildPrompt()` call. */
export const promptRequestSchema = z.object({
  /** The end-user's current question. */
  query: z.string().trim().min(1, 'query must not be empty'),

  /**
   * The retrieval result from Component 5. We validate only the
   * top-level shape here — `RetrievalResult` itself is already
   * validated by the Retriever's own Zod pipeline.
   */
  retrievalResult: z.object({
    query: z.string(),
    chunks: z.array(z.any()),
    isRelevant: z.boolean(),
    totalCandidates: z.number(),
    tookMs: z.number(),
  }),

  /**
   * Conversation history excluding the current query.
   * Usually passed in from Component 7 (Conversation Memory).
   */
  history: z.array(llmMessageSchema).default([]),
});

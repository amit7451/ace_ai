import type { RetrievalResult } from '../../retriever/types/retrieval-result.types';
import type { LLMMessage } from '../../llm/types/llm-message.types';

/**
 * The input required by `RagPromptBuilder` on every turn of conversation.
 */
export interface PromptRequest {
  /**
   * The exact query string the end-user typed.
   * This is typically passed as the final `user` message in the assembled prompt.
   */
  query: string;

  /**
   * The result of searching the vector store for knowledge relevant to `query`.
   * The builder relies on the `isRelevant` flag within this result to enforce
   * domain guardrails.
   */
  retrievalResult: RetrievalResult;

  /**
   * Optional conversation history (e.g., fetched by Component 7).
   * These messages are sandwiched between the system prompt and the final
   * user query.
   *
   * If the builder's config specifies a `maxHistoryMessages` limit, older
   * messages will be truncated automatically.
   */
  history?: LLMMessage[];
}

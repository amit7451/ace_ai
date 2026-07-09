import type { PromptRequest } from '../types/prompt-request.types';
import type { LLMMessage } from '../../llm/types/llm-message.types';

/**
 * Component 6 – Prompt Builder / Domain Guardrails.
 *
 * Responsible for assembling the final `LLMMessage[]` array that the
 * AI Orchestrator (Component 8) hands to the LLM Provider Layer
 * (Component 1). It combines:
 *
 *   1. The assistant's **system persona** (configured at construction).
 *   2. The **retrieved knowledge context** from the RAG Retriever
 *      (Component 5's `RetrievalResult`).
 *   3. The **conversation history** from Conversation Memory
 *      (Component 7's `LLMMessage[]`).
 *   4. The current **user query**.
 *
 * Critically, the builder enforces the platform's **Domain Guardrails**
 * (Architecture Principle 1 – Retrieval First): when the retriever
 * reports `isRelevant === false`, the builder either instructs the LLM
 * to politely decline or throws an `OutOfDomainError` — the LLM is
 * never allowed to answer from its own general knowledge about the
 * tenant's domain.
 *
 * Like every other component interface in this engine, `IPromptBuilder`
 * is a pure abstraction with no vendor dependency. The concrete
 * `RagPromptBuilder` is the default implementation shipped with the
 * engine, but downstream consumers are free to supply their own
 * implementation (e.g., a chain-of-thought builder, a multi-turn
 * summariser, etc.) by satisfying this contract.
 */
export interface IPromptBuilder {
  /**
   * Assembles the complete, ordered prompt for a single turn of
   * conversation.
   *
   * @param request - Contains the user query, retrieval result from
   *   Component 5, and optional conversation history from Component 7.
   * @returns A promise resolving to an ordered `LLMMessage[]` suitable
   *   for direct consumption by `ILLMProvider.chat()`.
   * @throws {OutOfDomainError} When `fallbackStrategy` is `'throw_error'`
   *   and the retrieval result indicates no relevant knowledge was found.
   * @throws {PromptBuilderError} On any template-rendering or
   *   validation failure.
   */
  buildPrompt(request: PromptRequest): Promise<LLMMessage[]>;
}

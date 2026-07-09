import type { RetrievalResult } from '../../retriever/types/retrieval-result.types';
import type { LLMResponse } from '../../llm/types/llm-response.types';

export interface ChatRequest {
  /** The tenant organization ID. */
  tenantId: string;
  /** The ID of the AI Assistant configuration being used. */
  assistantId: string;
  /** The unique conversation session ID. */
  sessionId: string;
  /** The raw user query. */
  query: string;
}

export interface ChatResponse {
  /** The final text response from the LLM or guardrail system. */
  content: string;
  /** The raw response object from the underlying LLM provider. */
  llmResponse?: LLMResponse;
  /** The knowledge retrieved from the vector store for debugging/tracing. */
  retrievalResult?: RetrievalResult;
}

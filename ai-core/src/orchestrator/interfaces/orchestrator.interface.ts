import type { ChatRequest, ChatResponse } from '../types/chat.types';

/**
 * Component 8: AI Orchestrator
 *
 * The apex interface that orchestrates the Retrieval-First pipeline:
 * Knowledge Retrieval -> Conversation Memory -> Prompt Building -> LLM Execution.
 */
export interface IAIOrchestrator {
  /**
   * Processes a single turn of conversation.
   * @param request The chat parameters (IDs, query)
   * @returns The final response with optional tracing data.
   */
  chat(request: ChatRequest): Promise<ChatResponse>;
}

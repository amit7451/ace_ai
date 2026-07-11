import type { ChatRequest, ChatResponse } from '../types/chat.types';

export interface ChatStreamChunk {
  type: 'chunk' | 'citation' | 'error';
  content?: string;
  citations?: any[];
  error?: string;
}

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

  /**
   * Processes a single turn of conversation and yields chunks as they are generated.
   * @param request The chat parameters
   * @returns An async generator yielding stream chunks
   */
  stream(request: ChatRequest): AsyncGenerator<ChatStreamChunk, void, unknown>;
}

import type { LLMMessage } from '../../llm/types/llm-message.types';

/**
 * Component 7: Conversation Memory
 *
 * Persistently stores the history of an active chat session.
 * The Prompt Builder (Component 6) pulls this history to maintain
 * context window awareness. 
 */
export interface IMemoryProvider {
  /**
   * Appends a new message to the given session's history.
   * @param sessionId The unique identifier for the tenant's chat session.
   * @param message The message (user or assistant) to append.
   */
  addMessage(sessionId: string, message: LLMMessage): Promise<void>;

  /**
   * Appends multiple messages in one operation.
   * Useful when pushing both a user message and an assistant response at the end of a turn.
   */
  addMessages(sessionId: string, messages: LLMMessage[]): Promise<void>;

  /**
   * Retrieves the conversation history for a session.
   * @param sessionId The unique identifier for the chat session.
   * @param limit Optionally restrict the number of recent messages fetched.
   * @returns An array of LLM messages in chronological order (oldest first).
   */
  getHistory(sessionId: string, limit?: number): Promise<LLMMessage[]>;

  /**
   * Deletes all history associated with a session.
   */
  clear(sessionId: string): Promise<void>;

  /**
   * Validates the connection to the underlying storage (e.g., Redis).
   */
  healthCheck(): Promise<boolean>;
}

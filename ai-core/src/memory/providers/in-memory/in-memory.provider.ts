import type { IMemoryProvider } from '../../interfaces/memory-provider.interface';
import type { LLMMessage } from '../../../llm/types/llm-message.types';
import type { ResolvedMemoryConfig } from '../../types/memory-config.types';

interface SessionData {
  messages: LLMMessage[];
  expiresAt?: number;
}

/**
 * A volatile memory provider using an in-memory Map.
 * Suitable for local development and testing (Principle 4).
 * Enforces TTL if configured, silently pruning expired sessions.
 */
export class InMemoryMemoryProvider implements IMemoryProvider {
  private readonly store = new Map<string, SessionData>();
  private readonly ttlMs?: number;

  constructor(config: ResolvedMemoryConfig) {
    if (config.ttlSeconds) {
      this.ttlMs = config.ttlSeconds * 1000;
    }
  }

  async addMessage(sessionId: string, message: LLMMessage): Promise<void> {
    this.prune(sessionId);
    
    let session = this.store.get(sessionId);
    if (!session) {
      session = { messages: [] };
      this.store.set(sessionId, session);
    }

    session.messages.push(message);
    
    if (this.ttlMs) {
      session.expiresAt = Date.now() + this.ttlMs;
    }
  }

  async addMessages(sessionId: string, messages: LLMMessage[]): Promise<void> {
    this.prune(sessionId);

    let session = this.store.get(sessionId);
    if (!session) {
      session = { messages: [] };
      this.store.set(sessionId, session);
    }

    session.messages.push(...messages);
    
    if (this.ttlMs) {
      session.expiresAt = Date.now() + this.ttlMs;
    }
  }

  async getHistory(sessionId: string, limit?: number): Promise<LLMMessage[]> {
    this.prune(sessionId);
    
    const session = this.store.get(sessionId);
    if (!session) {
      return [];
    }

    if (this.ttlMs) {
      session.expiresAt = Date.now() + this.ttlMs; // Extend TTL on read
    }

    const msgs = session.messages;
    if (limit !== undefined && limit > 0 && msgs.length > limit) {
      return msgs.slice(-limit);
    }
    return [...msgs];
  }

  async clear(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }

  async healthCheck(): Promise<boolean> {
    return true; // Map is always healthy
  }

  private prune(sessionId: string): void {
    const session = this.store.get(sessionId);
    if (session?.expiresAt && Date.now() > session.expiresAt) {
      this.store.delete(sessionId);
    }
  }
}

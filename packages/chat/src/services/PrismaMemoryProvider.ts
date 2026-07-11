import { IMemoryProvider, LLMMessage } from '@ai-chatbot-platform/ai-core';
import { conversationService } from './ConversationService';

export class PrismaMemoryProvider implements IMemoryProvider {
  async addMessage(sessionId: string, message: LLMMessage): Promise<void> {
    await this.addMessages(sessionId, [message]);
  }

  async addMessages(sessionId: string, messages: LLMMessage[]): Promise<void> {
    await conversationService.persistMessages(
      sessionId,
      messages.map((m) => ({
        role:
          m.role === 'user' || m.role === 'assistant' || m.role === 'system' ? m.role : 'assistant',
        content: m.content,
      }))
    );
  }

  async getHistory(sessionId: string, limit?: number): Promise<LLMMessage[]> {
    return await conversationService.getHistory(sessionId, limit);
  }

  async clear(sessionId: string): Promise<void> {
    // We do not physically delete messages in production SaaS, we just archive the conversation.
    // The ai-core interface doesn't know about archiving, so we just ignore this for Prisma.
    // A new session ID should be generated for a new conversation.
  }

  async healthCheck(): Promise<boolean> {
    return true; // Prisma healthcheck happens at infrastructure level
  }
}

import { conversationRepository } from '../repositories/ConversationRepository';
import { ConversationStatus, MessageRole, Conversation, Message } from '@prisma/client';
import { LLMMessage } from '@ai-chatbot-platform/ai-core';

export class ConversationService {
  async createConversation(organizationId: string, deploymentId?: string, visitorId?: string) {
    return await conversationRepository.create({
      organizationId,
      deploymentId,
      visitorId,
      status: ConversationStatus.ACTIVE,
    });
  }

  async getConversation(id: string) {
    return await conversationRepository.findByIdWithMessages(id);
  }

  async getConversationWithVisitor(id: string) {
    return await conversationRepository.findByIdWithMessagesAndVisitor(id);
  }

  async getConversationsByOrganization(organizationId: string) {
    return await conversationRepository.findManyByOrganizationId(organizationId);
  }

  async getHistory(conversationId: string, limit?: number): Promise<LLMMessage[]> {
    const messages = await conversationRepository.getMessagesByConversationId(
      conversationId,
      limit
    );

    return messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
      content: msg.content,
    }));
  }

  async persistMessages(
    conversationId: string,
    messages: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      model?: string;
      provider?: string;
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      responseTimeMs?: number;
      citations?: any;
    }[]
  ) {
    await conversationRepository.persistMessagesTransaction(conversationId, messages);
  }
}

export const conversationService = new ConversationService();

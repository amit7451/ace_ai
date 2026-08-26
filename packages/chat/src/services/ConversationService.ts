import { conversationRepository } from '../repositories/ConversationRepository';
import { ConversationStatus, MessageRole, Conversation, Message } from '@prisma/client';
import { LLMMessage } from '@ion-ai/ai-core';

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

  /**
   * Verifies that a conversation belongs to the specified organization and (optionally) deployment.
   * Returns the conversation if ownership is confirmed.
   * Returns null if the conversation doesn't exist or belongs to a different tenant.
   *
   * SECURITY: This is the authorization gate for client-supplied conversationIds.
   * Callers MUST reject with 404 (not 403) on null to avoid confirming ID existence.
   */
  async verifyOwnership(
    conversationId: string,
    organizationId: string,
    deploymentId?: string
  ): Promise<Conversation | null> {
    const conversation = await conversationRepository.findById(conversationId);

    if (!conversation) {
      return null;
    }

    if (conversation.organizationId !== organizationId) {
      return null;
    }

    if (deploymentId && conversation.deploymentId !== deploymentId) {
      return null;
    }

    return conversation;
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

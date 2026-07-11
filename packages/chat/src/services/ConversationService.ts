import { prisma } from '@ion-ai/database';
import { ConversationStatus, MessageRole, Conversation, Message } from '@prisma/client';
import { LLMMessage } from '@ai-chatbot-platform/ai-core';

export class ConversationService {
  async createConversation(organizationId: string, deploymentId?: string, visitorId?: string) {
    return await prisma.conversation.create({
      data: {
        organizationId,
        deploymentId,
        visitorId,
        status: ConversationStatus.ACTIVE,
      },
    });
  }

  async getConversation(id: string) {
    return await prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async getHistory(conversationId: string, limit?: number): Promise<LLMMessage[]> {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit ? -limit : undefined, // take last N messages if limit provided
    });

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
    await prisma.$transaction(async (tx) => {
      for (const msg of messages) {
        await tx.message.create({
          data: {
            conversationId,
            role: msg.role as MessageRole,
            content: msg.content,
            model: msg.model,
            provider: msg.provider,
            promptTokens: msg.promptTokens,
            completionTokens: msg.completionTokens,
            totalTokens: msg.totalTokens,
            responseTimeMs: msg.responseTimeMs,
            citations: msg.citations ? JSON.parse(JSON.stringify(msg.citations)) : undefined,
          },
        });
      }
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastActivity: new Date() },
      });
    });
  }
}

export const conversationService = new ConversationService();

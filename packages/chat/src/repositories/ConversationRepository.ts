import { prisma, Prisma } from '@ion-ai/database';
import { ConversationStatus, MessageRole } from '@prisma/client';

export class ConversationRepository {
  async create(data: Prisma.ConversationUncheckedCreateInput) {
    return prisma.conversation.create({ data });
  }

  async findByIdWithMessages(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async findByIdWithMessagesAndVisitor(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } }, visitor: true },
    });
  }

  async findManyByOrganizationId(organizationId: string) {
    return prisma.conversation.findMany({
      where: { organizationId },
      orderBy: { lastActivity: 'desc' },
      include: { visitor: true },
    });
  }

  async getMessagesByConversationId(conversationId: string, limit?: number) {
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit ? -limit : undefined,
    });
  }

  async persistMessagesTransaction(conversationId: string, messages: any[]) {
    return prisma.$transaction(async (tx) => {
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

export const conversationRepository = new ConversationRepository();

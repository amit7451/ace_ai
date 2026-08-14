import { prisma, Prisma } from '@ion-ai/database';

export class ChatRepository {
  async getOrganizationMember(userId: string, organizationId: string) {
    return prisma.organizationMember.findFirst({
      where: { userId, organizationId },
    });
  }

  async getVisitorSession(organizationId: string, ipHash: string) {
    return prisma.visitorSession.findFirst({
      where: { organizationId, ipHash },
    });
  }

  async createVisitorSession(data: Prisma.VisitorSessionUncheckedCreateInput) {
    return prisma.visitorSession.create({ data });
  }

  async upsertVisitorSession(organizationId: string, ipHash: string, userAgent?: string) {
    return prisma.visitorSession.upsert({
      where: { organizationId_ipHash: { organizationId, ipHash } },
      create: { organizationId, ipHash, userAgent },
      update: { lastSeen: new Date(), ...(userAgent ? { userAgent } : {}) },
    });
  }

  async getOrganizationConfig(organizationId: string) {
    return prisma.organizationConfiguration.findUnique({
      where: { organizationId },
    });
  }

  async getOrganizationApiKey(organizationId: string, provider: string) {
    return prisma.organizationApiKey.findUnique({
      where: { organizationId_provider: { organizationId, provider } },
    });
  }
}

export const chatRepository = new ChatRepository();

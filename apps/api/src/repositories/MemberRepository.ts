import { prisma, OrganizationMember, Prisma } from '@ion-ai/database';

export class MemberRepository {
  async findByUserAndOrganization(
    userId: string,
    organizationId: string
  ): Promise<OrganizationMember | null> {
    return prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });
  }

  async findByOrganization(organizationId: string): Promise<OrganizationMember[]> {
    return prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: true },
    });
  }

  async create(data: Prisma.OrganizationMemberUncheckedCreateInput): Promise<OrganizationMember> {
    return prisma.organizationMember.create({ data });
  }
}

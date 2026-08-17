import {
  prisma,
  OrganizationMember,
  OrganizationInvitation,
  Prisma,
  InvitationStatus,
} from '@ion-ai/database';

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
      orderBy: { createdAt: 'asc' },
    });
  }

  async findMemberByEmailAndOrganization(
    email: string,
    organizationId: string
  ): Promise<OrganizationMember | null> {
    return prisma.organizationMember.findFirst({
      where: {
        organizationId,
        user: { email: { equals: email, mode: 'insensitive' } },
      },
      include: { user: true },
    });
  }

  async create(data: Prisma.OrganizationMemberUncheckedCreateInput): Promise<OrganizationMember> {
    return prisma.organizationMember.create({ data });
  }

  async upsertMember(
    organizationId: string,
    userId: string,
    role: any,
    status: any
  ): Promise<OrganizationMember> {
    return prisma.organizationMember.upsert({
      where: {
        organizationId_userId: { organizationId, userId },
      },
      create: {
        organizationId,
        userId,
        role,
        status,
        joinedAt: new Date(),
      },
      update: {
        role,
        status,
        joinedAt: new Date(),
      },
    });
  }

  // ── Invitations ──

  async createInvitation(
    data: Prisma.OrganizationInvitationUncheckedCreateInput
  ): Promise<OrganizationInvitation> {
    return prisma.organizationInvitation.create({
      data,
      include: {
        organization: true,
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async findInvitationByToken(token: string) {
    return prisma.organizationInvitation.findUnique({
      where: { token },
      include: {
        organization: true,
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  async findInvitationById(id: string) {
    return prisma.organizationInvitation.findUnique({
      where: { id },
      include: {
        organization: true,
      },
    });
  }

  async findPendingInvitations(organizationId: string) {
    return prisma.organizationInvitation.findMany({
      where: {
        organizationId,
        status: InvitationStatus.PENDING,
      },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokePendingInvitationsForEmail(organizationId: string, email: string) {
    return prisma.organizationInvitation.updateMany({
      where: {
        organizationId,
        email: { equals: email, mode: 'insensitive' },
        status: InvitationStatus.PENDING,
      },
      data: {
        status: InvitationStatus.REVOKED,
      },
    });
  }

  async updateInvitationStatus(id: string, status: InvitationStatus) {
    return prisma.organizationInvitation.update({
      where: { id },
      data: { status },
    });
  }
}

import { prisma, AuditLog, Prisma } from '@ion-ai/database';

export class AuditLogRepository {
  async create(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLog> {
    return prisma.auditLog.create({ data });
  }

  async findByOrganizationId(organizationId: string): Promise<AuditLog[]> {
    return prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

import { prisma, Organization, Prisma } from '@ion-ai/database';

export class OrganizationRepository {
  async findById(id: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { slug } });
  }

  async findByUserId(userId: string): Promise<Organization[]> {
    return prisma.organization.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
    });
  }

  async create(data: Prisma.OrganizationCreateInput): Promise<Organization> {
    return prisma.organization.create({ data });
  }
}

import { prisma, OrganizationConfiguration, Prisma } from '@ion-ai/database';

export class ConfigurationRepository {
  async findByOrganizationId(organizationId: string): Promise<OrganizationConfiguration | null> {
    return prisma.organizationConfiguration.findUnique({
      where: { organizationId },
    });
  }

  async upsert(
    organizationId: string,
    data: Prisma.OrganizationConfigurationUncheckedCreateInput
  ): Promise<OrganizationConfiguration> {
    return prisma.organizationConfiguration.upsert({
      where: { organizationId },
      create: data,
      update: data,
    });
  }
}

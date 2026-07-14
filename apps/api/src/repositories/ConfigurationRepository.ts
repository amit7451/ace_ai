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

  async findApiKeysByOrganizationId(organizationId: string) {
    return prisma.organizationApiKey.findMany({ where: { organizationId } });
  }

  async getApiKey(organizationId: string, provider: string) {
    return prisma.organizationApiKey.findUnique({
      where: { organizationId_provider: { organizationId, provider } },
    });
  }

  async upsertApiKey(organizationId: string, provider: string, encryptedKey: string) {
    return prisma.organizationApiKey.upsert({
      where: { organizationId_provider: { organizationId, provider } },
      create: { organizationId, provider, encryptedKey },
      update: { encryptedKey },
    });
  }

  async deleteApiKey(organizationId: string, provider: string) {
    return prisma.organizationApiKey.delete({
      where: { organizationId_provider: { organizationId, provider } },
    });
  }
}

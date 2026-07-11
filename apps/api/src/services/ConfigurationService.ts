import { ConfigurationRepository } from '../repositories/ConfigurationRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { UpdateOrganizationConfigurationRequest } from '@ion-ai/contracts';
import { Role, hasPermission } from '@ion-ai/auth';

export class ConfigurationService {
  constructor(
    private configRepo: ConfigurationRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async getConfiguration(organizationId: string) {
    let config = await this.configRepo.findByOrganizationId(organizationId);
    if (!config) {
      // Return defaults if none exists
      config = await this.configRepo.upsert(organizationId, {
        organizationId,
        llmProvider: 'openai',
        embeddingProvider: 'openai',
        temperature: 0.7,
      });
    }
    return config;
  }

  async updateConfiguration(
    organizationId: string,
    actorId: string,
    actorRole: Role,
    data: UpdateOrganizationConfigurationRequest
  ) {
    if (!hasPermission(actorRole, Role.ADMIN)) {
      throw Object.assign(new Error('Insufficient permissions to update configuration'), {
        statusCode: 403,
      });
    }

    const config = await this.configRepo.upsert(organizationId, {
      organizationId,
      ...data,
    });

    await this.auditRepo.create({
      organizationId,
      action: 'CONFIGURATION_UPDATED',
      actorId,
      metadata: data,
    });

    return config;
  }
}

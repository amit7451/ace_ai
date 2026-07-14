import { ConfigurationRepository } from '../repositories/ConfigurationRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { UpdateOrganizationConfigurationRequest } from '@ion-ai/contracts';
import { Role, hasPermission } from '@ion-ai/auth';
import { encryptApiKey, decryptApiKey } from '@ion-ai/config';

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
        llmProvider: 'testing',
        embeddingProvider: 'testing',
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

  async getApiKeys(organizationId: string) {
    const keys = await this.configRepo.findApiKeysByOrganizationId(organizationId);
    return keys.map((k) => ({
      provider: k.provider,
      hasKey: true,
      updatedAt: k.updatedAt,
    }));
  }

  async getDecryptedApiKey(organizationId: string, provider: string): Promise<string | null> {
    const key = await this.configRepo.getApiKey(organizationId, provider);
    if (!key) return null;
    return decryptApiKey(key.encryptedKey);
  }

  async saveApiKey(
    organizationId: string,
    actorId: string,
    actorRole: Role,
    provider: string,
    apiKey: string
  ) {
    if (!hasPermission(actorRole, Role.ADMIN)) {
      throw Object.assign(new Error('Insufficient permissions to manage API keys'), {
        statusCode: 403,
      });
    }
    const encryptedKey = encryptApiKey(apiKey);
    await this.configRepo.upsertApiKey(organizationId, provider, encryptedKey);
    await this.auditRepo.create({
      organizationId,
      action: 'API_KEY_UPDATED',
      actorId,
      metadata: { provider },
    });
    return { success: true };
  }

  async deleteApiKey(organizationId: string, actorId: string, actorRole: Role, provider: string) {
    if (!hasPermission(actorRole, Role.ADMIN)) {
      throw Object.assign(new Error('Insufficient permissions to manage API keys'), {
        statusCode: 403,
      });
    }
    await this.configRepo.deleteApiKey(organizationId, provider);
    await this.auditRepo.create({
      organizationId,
      action: 'API_KEY_DELETED',
      actorId,
      metadata: { provider },
    });
    return { success: true };
  }
}

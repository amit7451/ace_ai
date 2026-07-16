import { OrganizationRepository } from '../repositories/OrganizationRepository';
import { MemberRepository } from '../repositories/MemberRepository';
import { ConfigurationRepository } from '../repositories/ConfigurationRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { CreateOrganizationRequest } from '@ion-ai/contracts';
import { Role } from '@ion-ai/auth';

export class OrganizationService {
  constructor(
    private orgRepo: OrganizationRepository,
    private memberRepo: MemberRepository,
    private configRepo: ConfigurationRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async createOrganization(userId: string, data: CreateOrganizationRequest) {
    let baseSlug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    if (!baseSlug) {
      baseSlug = 'organization';
    }

    let slug = baseSlug;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique) {
      const existing = await this.orgRepo.findBySlug(slug);
      if (!existing) {
        isUnique = true;
      } else {
        attempts++;
        if (attempts > 10) {
          throw new Error('Failed to generate a unique organization slug');
        }
        const suffix = Math.random().toString(36).substring(2, 8);
        slug = `${baseSlug}-${suffix}`;
      }
    }

    // Create org
    const org = await this.orgRepo.create({ name: data.name, slug });

    // Make user owner
    await this.memberRepo.create({
      organizationId: org.id,
      userId,
      role: Role.OWNER,
      status: 'ACTIVE',
      joinedAt: new Date(),
    });

    // Default configuration
    await this.configRepo.upsert(org.id, {
      organizationId: org.id,
      llmProvider: 'openai',
      embeddingProvider: 'openai',
      temperature: 0.7,
    });

    // Audit log
    await this.auditRepo.create({
      organizationId: org.id,
      action: 'ORGANIZATION_CREATED',
      actorId: userId,
      metadata: { name: data.name },
    });

    return org;
  }

  async getMyOrganizations(userId: string) {
    return this.orgRepo.findByUserId(userId);
  }
}

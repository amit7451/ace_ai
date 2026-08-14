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

    // Default configuration (Testing Tier by default)
    await this.configRepo.upsert(org.id, {
      organizationId: org.id,
      llmProvider: 'testing',
      embeddingProvider: 'testing',
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

  async deleteOrganization(userId: string, organizationId: string, confirmationName?: string) {
    const member = await this.memberRepo.findByUserAndOrganization(userId, organizationId);
    if (!member || member.role !== Role.OWNER) {
      throw Object.assign(
        new Error('Only the institution owner can delete this institution account.'),
        { statusCode: 403 }
      );
    }

    // Require the caller to confirm by typing the org name (defense against accidental deletion)
    const org = await this.orgRepo.findById(organizationId);
    if (!org) {
      throw Object.assign(new Error('Organization not found'), { statusCode: 404 });
    }

    if (!confirmationName || confirmationName !== org.name) {
      throw Object.assign(
        new Error('Confirmation required: provide the organization name to confirm deletion.'),
        { statusCode: 400 }
      );
    }

    // Cascade delete the organization.
    // Prisma's onDelete: Cascade handles members, configuration, API keys,
    // audit logs, knowledge sources, conversations, etc.
    //
    // SECURITY: We deliberately do NOT auto-delete user accounts of former members.
    // A user's account belongs to that user, not to the organization.
    // Users who lose their last org will see an empty state and can create a new one.
    const deletedOrg = await this.orgRepo.delete(organizationId);

    return deletedOrg;
  }
}

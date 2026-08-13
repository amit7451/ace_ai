import { OrganizationRepository } from '../repositories/OrganizationRepository';
import { MemberRepository } from '../repositories/MemberRepository';
import { ConfigurationRepository } from '../repositories/ConfigurationRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { UserRepository } from '../repositories/UserRepository';
import { CreateOrganizationRequest } from '@ion-ai/contracts';
import { Role } from '@ion-ai/auth';
import { prisma } from '@ion-ai/database';

export class OrganizationService {
  constructor(
    private orgRepo: OrganizationRepository,
    private memberRepo: MemberRepository,
    private configRepo: ConfigurationRepository,
    private auditRepo: AuditLogRepository,
    private userRepo?: UserRepository
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

  async deleteOrganization(userId: string, organizationId: string) {
    const member = await this.memberRepo.findByUserAndOrganization(userId, organizationId);
    if (!member || (member.role !== Role.OWNER && member.role !== Role.ADMIN)) {
      throw Object.assign(
        new Error('Only an institution owner or admin can delete this institution account.'),
        {
          statusCode: 403,
        }
      );
    }

    // Find all member user IDs before cascade deletion
    const members = await this.memberRepo.findByOrganization(organizationId);
    const affectedUserIds = Array.from(new Set(members.map((m) => m.userId)));

    // Cascade delete the organization
    const deletedOrg = await this.orgRepo.delete(organizationId);

    // Purge user records if they have 0 remaining organizations
    for (const uId of affectedUserIds) {
      const remainingOrgs = await this.orgRepo.findByUserId(uId);
      if (remainingOrgs.length === 0) {
        await prisma.user.delete({ where: { id: uId } }).catch(() => {});
      }
    }

    return deletedOrg;
  }
}

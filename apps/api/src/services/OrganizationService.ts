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

    if (!confirmationName || confirmationName.trim() !== org.name.trim()) {
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

  async getOrganizationSummary(organizationId: string, userId?: string) {
    const { prisma } = await import('@ion-ai/database');

    const [
      org,
      config,
      members,
      pendingInvitesCount,
      sources,
      crawlers,
      ingestionJobs,
      deployments,
      auditLogs,
    ] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.organizationConfiguration.findUnique({ where: { organizationId } }),
      prisma.organizationMember.findMany({
        where: { organizationId },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.organizationInvitation.count({
        where: { organizationId, status: 'PENDING' },
      }),
      prisma.knowledgeSource.findMany({
        where: { organizationId },
        include: {
          document: {
            select: { sizeBytes: true, mimeType: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.crawlJob.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ingestionJob.findMany({
        where: { knowledgeSource: { organizationId } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.deployment.findMany({
        where: { organizationId },
        include: { widgets: true },
      }),
      prisma.auditLog.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    if (!org) {
      throw Object.assign(new Error('Organization not found'), { statusCode: 404 });
    }

    // 1. Knowledge metrics
    const totalSources = sources.length;
    let completedSources = 0;
    let processingSources = 0;
    let failedSources = 0;
    let totalSizeBytes = 0;
    const byType: Record<string, number> = {
      PDF: 0,
      DOCX: 0,
      TXT: 0,
      MARKDOWN: 0,
      WEBSITE: 0,
    };

    for (const s of sources) {
      if (s.status === 'COMPLETED') completedSources++;
      else if (s.status === 'FAILED') failedSources++;
      else processingSources++;

      if (s.sourceType && byType[s.sourceType] !== undefined) {
        byType[s.sourceType]++;
      }
      if (s.document?.sizeBytes) {
        totalSizeBytes += s.document.sizeBytes;
      }
    }

    // 2. Crawler metrics
    const totalCrawlers = crawlers.length;
    let activeCrawlers = 0;
    let completedCrawlers = 0;
    let failedCrawlers = 0;
    let totalPagesCrawled = 0;

    for (const c of crawlers) {
      if (c.status === 'RUNNING' || c.status === 'PENDING') activeCrawlers++;
      else if (c.status === 'COMPLETED') completedCrawlers++;
      else if (c.status === 'FAILED') failedCrawlers++;

      totalPagesCrawled += c.pagesCrawled || 0;
    }

    // 3. Ingestion Jobs metrics
    const totalJobs = ingestionJobs.length;
    let runningJobs = 0;
    let completedJobs = 0;
    let failedJobs = 0;

    for (const j of ingestionJobs) {
      if (j.status === 'RUNNING' || j.status === 'PENDING' || j.status === 'RETRYING')
        runningJobs++;
      else if (j.status === 'COMPLETED') completedJobs++;
      else if (j.status === 'FAILED') failedJobs++;
    }

    // 4. Member metrics & user role
    const membersByRole: Record<string, number> = {
      OWNER: 0,
      ADMIN: 0,
      EDITOR: 0,
      VIEWER: 0,
    };
    let currentUserRole = 'VIEWER';

    for (const m of members) {
      if (membersByRole[m.role] !== undefined) {
        membersByRole[m.role]++;
      }
      if (userId && m.userId === userId) {
        currentUserRole = m.role;
      }
    }

    // 5. Deployment & Widget metrics
    let totalWidgets = 0;
    let activeWidgets = 0;
    const widgetPublicKeys: string[] = [];

    for (const d of deployments) {
      for (const w of d.widgets) {
        totalWidgets++;
        if (w.enabled) activeWidgets++;
        if (w.publicKey) widgetPublicKeys.push(w.publicKey);
      }
    }

    return {
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      },
      configuration: config || {
        llmProvider: 'testing',
        embeddingProvider: 'testing',
        temperature: 0.7,
      },
      stats: {
        knowledge: {
          total: totalSources,
          completed: completedSources,
          processing: processingSources,
          failed: failedSources,
          byType,
          totalSizeBytes,
          maxStorageQuotaBytes: 20 * 1024 * 1024, // 20 MB
        },
        crawlers: {
          total: totalCrawlers,
          active: activeCrawlers,
          completed: completedCrawlers,
          failed: failedCrawlers,
          totalPagesCrawled,
        },
        jobs: {
          total: totalJobs,
          running: runningJobs,
          completed: completedJobs,
          failed: failedJobs,
        },
        members: {
          total: members.length,
          byRole: membersByRole,
          pendingInvitations: pendingInvitesCount,
          currentUserRole,
        },
        widgets: {
          deploymentsCount: deployments.length,
          totalWidgets,
          activeWidgets,
          publicKeys: widgetPublicKeys,
        },
      },
      recentSources: sources.slice(0, 5).map((s) => ({
        id: s.id,
        sourceType: s.sourceType,
        status: s.status,
        createdAt: s.createdAt,
        sizeBytes: s.document?.sizeBytes || 0,
      })),
      recentCrawlers: crawlers.slice(0, 5).map((c) => ({
        id: c.id,
        url: c.url,
        status: c.status,
        pagesCrawled: c.pagesCrawled,
        createdAt: c.createdAt,
      })),
      recentActivity: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        actorId: log.actorId,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
    };
  }
}

import { MemberRepository } from '../repositories/MemberRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { EmailService } from './EmailService';
import { Role, hasPermission } from '@ion-ai/auth';
import { env } from '@ion-ai/config';
import { prisma, InvitationStatus } from '@ion-ai/database';
import crypto from 'crypto';

export class MemberService {
  constructor(
    private memberRepo: MemberRepository,
    private auditRepo: AuditLogRepository,
    private emailService: EmailService
  ) {}

  async getMembers(organizationId: string) {
    return this.memberRepo.findByOrganization(organizationId);
  }

  async getPendingInvitations(organizationId: string) {
    return this.memberRepo.findPendingInvitations(organizationId);
  }

  async inviteMember(
    organizationId: string,
    inviterId: string,
    inviterRole: Role,
    email: string,
    role: Role
  ) {
    if (!hasPermission(inviterRole, Role.ADMIN)) {
      throw Object.assign(new Error('Insufficient permissions to invite members'), {
        statusCode: 403,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check if user is already an active member of this organization
    const existingMember = await this.memberRepo.findMemberByEmailAndOrganization(
      normalizedEmail,
      organizationId
    );
    if (existingMember && existingMember.status === 'ACTIVE') {
      throw Object.assign(
        new Error(
          `User with email "${normalizedEmail}" is already an active member of this workspace`
        ),
        { statusCode: 400 }
      );
    }

    // 2. Invalidate any existing pending invitations for this email in this organization
    await this.memberRepo.revokePendingInvitationsForEmail(organizationId, normalizedEmail);

    // 3. Generate cryptographic invitation token and 7-day expiration
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // 4. Create Invitation record
    const invitation = await this.memberRepo.createInvitation({
      organizationId,
      email: normalizedEmail,
      role: role as any,
      token,
      invitedById: inviterId,
      status: InvitationStatus.PENDING,
      expiresAt,
    });

    const inviteUrl = `${env.FRONTEND_URL}/accept-invitation?token=${token}`;

    // 5. Lookup inviter and organization info for email
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    const inviter = await prisma.user.findUnique({
      where: { id: inviterId },
    });

    // 6. Send transactional invitation email
    await this.emailService.sendInvitationEmail({
      to: normalizedEmail,
      inviterName: inviter?.name || inviter?.email || 'A team administrator',
      organizationName: organization?.name || 'Workspace',
      role,
      inviteUrl,
      expiresAt,
    });

    // 7. Audit log the invitation
    await this.auditRepo.create({
      organizationId,
      action: 'MEMBER_INVITED',
      actorId: inviterId,
      metadata: { email: normalizedEmail, role, invitationId: invitation.id, expiresAt },
    });

    return {
      success: true,
      message: `Invitation successfully sent to ${normalizedEmail}`,
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
        inviteUrl,
      },
    };
  }

  async revokeInvitation(
    organizationId: string,
    invitationId: string,
    actorId: string,
    actorRole: Role
  ) {
    if (!hasPermission(actorRole, Role.ADMIN)) {
      throw Object.assign(new Error('Insufficient permissions to manage invitations'), {
        statusCode: 403,
      });
    }

    const invitation = await this.memberRepo.findInvitationById(invitationId);
    if (!invitation || invitation.organizationId !== organizationId) {
      throw Object.assign(new Error('Invitation not found in this organization'), {
        statusCode: 404,
      });
    }

    await this.memberRepo.updateInvitationStatus(invitationId, InvitationStatus.REVOKED);

    await this.auditRepo.create({
      organizationId,
      action: 'INVITATION_REVOKED',
      actorId,
      metadata: { invitationId, email: invitation.email },
    });

    return { success: true, message: 'Invitation revoked successfully' };
  }

  async getInvitationDetails(token: string) {
    if (!token || typeof token !== 'string') {
      throw Object.assign(new Error('Invalid invitation token'), { statusCode: 400 });
    }

    const invitation = await this.memberRepo.findInvitationByToken(token);
    if (!invitation) {
      throw Object.assign(new Error('Invitation not found or invalid'), { statusCode: 404 });
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw Object.assign(new Error('This invitation has already been accepted'), {
        statusCode: 400,
      });
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      throw Object.assign(
        new Error('This invitation has been revoked by the workspace administrator'),
        {
          statusCode: 400,
        }
      );
    }

    if (new Date() > invitation.expiresAt) {
      await this.memberRepo.updateInvitationStatus(invitation.id, InvitationStatus.EXPIRED);
      throw Object.assign(new Error('This invitation has expired'), { statusCode: 400 });
    }

    return {
      success: true,
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        organizationId: invitation.organizationId,
        organizationName: invitation.organization.name,
        inviterName: invitation.invitedBy?.name || invitation.invitedBy?.email || 'A team member',
        expiresAt: invitation.expiresAt,
      },
    };
  }

  async acceptInvitation(token: string, userId: string, userEmail?: string) {
    if (!token || typeof token !== 'string') {
      throw Object.assign(new Error('Invalid invitation token'), { statusCode: 400 });
    }

    const invitation = await this.memberRepo.findInvitationByToken(token);
    if (!invitation) {
      throw Object.assign(new Error('Invitation not found or invalid'), { statusCode: 404 });
    }

    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw Object.assign(new Error('This invitation has already been accepted'), {
        statusCode: 400,
      });
    }

    if (invitation.status === InvitationStatus.REVOKED) {
      throw Object.assign(
        new Error('This invitation has been revoked by the workspace administrator'),
        {
          statusCode: 400,
        }
      );
    }

    if (new Date() > invitation.expiresAt) {
      await this.memberRepo.updateInvitationStatus(invitation.id, InvitationStatus.EXPIRED);
      throw Object.assign(new Error('This invitation has expired'), { statusCode: 400 });
    }

    // Activate membership
    const member = await this.memberRepo.upsertMember(
      invitation.organizationId,
      userId,
      invitation.role,
      'ACTIVE'
    );

    // Mark invitation accepted
    await this.memberRepo.updateInvitationStatus(invitation.id, InvitationStatus.ACCEPTED);

    // Create Audit log
    await this.auditRepo.create({
      organizationId: invitation.organizationId,
      action: 'MEMBER_JOINED',
      actorId: userId,
      metadata: {
        invitationId: invitation.id,
        role: invitation.role,
        acceptedEmail: userEmail || invitation.email,
      },
    });

    return {
      success: true,
      message: `Successfully joined ${invitation.organization.name}`,
      data: {
        organizationId: invitation.organizationId,
        organizationName: invitation.organization.name,
        role: invitation.role,
        memberId: member.id,
      },
    };
  }
}

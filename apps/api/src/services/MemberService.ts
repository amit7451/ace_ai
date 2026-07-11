import { MemberRepository } from '../repositories/MemberRepository';
import { AuditLogRepository } from '../repositories/AuditLogRepository';
import { Role, hasPermission } from '@ion-ai/auth';

export class MemberService {
  constructor(
    private memberRepo: MemberRepository,
    private auditRepo: AuditLogRepository
  ) {}

  async getMembers(organizationId: string) {
    return this.memberRepo.findByOrganization(organizationId);
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

    // In a real app, this would create an invitation token and send an email
    // For now we just log it
    await this.auditRepo.create({
      organizationId,
      action: 'MEMBER_INVITED',
      actorId: inviterId,
      metadata: { email, role },
    });

    return { success: true, message: `Invitation sent to ${email}` };
  }
}

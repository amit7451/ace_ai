import { OrganizationService } from '../src/services/OrganizationService';
import { Role } from '@ion-ai/auth';

describe('OrganizationService Security (F4)', () => {
  let orgService: OrganizationService;
  let mockOrgRepo: any;
  let mockMemberRepo: any;
  let mockConfigRepo: any;
  let mockAuditRepo: any;

  beforeEach(() => {
    mockOrgRepo = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    mockMemberRepo = {
      findByUserAndOrganization: jest.fn(),
      create: jest.fn(),
    };
    mockConfigRepo = {
      upsert: jest.fn(),
    };
    mockAuditRepo = {
      create: jest.fn(),
    };

    orgService = new OrganizationService(
      mockOrgRepo,
      mockMemberRepo,
      mockConfigRepo,
      mockAuditRepo
    );
  });

  describe('deleteOrganization', () => {
    it('should allow the OWNER to delete an organization with name confirmation', async () => {
      mockMemberRepo.findByUserAndOrganization.mockResolvedValue({
        userId: 'user-owner',
        organizationId: 'org-1',
        role: Role.OWNER,
      });
      mockOrgRepo.findById.mockResolvedValue({
        id: 'org-1',
        name: 'Acme Corp',
      });
      mockOrgRepo.delete.mockResolvedValue({ id: 'org-1' });

      await expect(
        orgService.deleteOrganization('user-owner', 'org-1', 'Acme Corp')
      ).resolves.not.toThrow();

      expect(mockOrgRepo.delete).toHaveBeenCalledWith('org-1');
    });

    it('should reject non-OWNER roles (e.g. ADMIN) with 403 Forbidden', async () => {
      mockMemberRepo.findByUserAndOrganization.mockResolvedValue({
        userId: 'user-admin',
        organizationId: 'org-1',
        role: Role.ADMIN,
      });

      await expect(
        orgService.deleteOrganization('user-admin', 'org-1', 'Acme Corp')
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Only the institution owner can delete'),
      });
      expect(mockOrgRepo.delete).not.toHaveBeenCalled();
    });

    it('should reject non-members with 403 Forbidden', async () => {
      mockMemberRepo.findByUserAndOrganization.mockResolvedValue(null);

      await expect(
        orgService.deleteOrganization('stranger', 'org-1', 'Acme Corp')
      ).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(mockOrgRepo.delete).not.toHaveBeenCalled();
    });

    it('should reject deletion when confirmationName does not match organization name', async () => {
      mockMemberRepo.findByUserAndOrganization.mockResolvedValue({
        userId: 'user-owner',
        organizationId: 'org-1',
        role: Role.OWNER,
      });
      mockOrgRepo.findById.mockResolvedValue({
        id: 'org-1',
        name: 'Acme Corp',
      });

      await expect(
        orgService.deleteOrganization('user-owner', 'org-1', 'Wrong Name')
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Confirmation required'),
      });
      expect(mockOrgRepo.delete).not.toHaveBeenCalled();
    });
  });
});

import Fastify, { FastifyInstance } from 'fastify';
import orgContextPlugin from '../src/plugins/org-context';
import { organizationRepository, memberRepository } from '../src/di';

jest.mock('../src/di', () => ({
  organizationRepository: {
    findById: jest.fn(),
  },
  memberRepository: {
    findByUserAndOrganization: jest.fn(),
  },
}));

describe('orgContextPlugin', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();
    app = Fastify();

    // Mock authenticate decorator
    app.decorateRequest('user', null);
    app.addHook('preHandler', async (req) => {
      req.user = { sub: 'user-123' };
    });

    await app.register(orgContextPlugin);

    app.get('/test/:orgId', { preHandler: app.requireOrganization }, async (req) => {
      return {
        org: req.organization,
        role: req.memberRole,
      };
    });
  });

  it('should accept valid param :orgId when user is an active member', async () => {
    (organizationRepository.findById as jest.Mock).mockResolvedValue({
      id: 'org-1',
      name: 'Test Org',
    });
    (memberRepository.findByUserAndOrganization as jest.Mock).mockResolvedValue({
      id: 'mem-1',
      userId: 'user-123',
      organizationId: 'org-1',
      role: 'OWNER',
      status: 'ACTIVE',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test/org-1',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.org.id).toBe('org-1');
    expect(body.role).toBe('OWNER');
  });

  it('should reject when param :orgId conflicts with x-organization-id header (F9)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test/org-1',
      headers: {
        'x-organization-id': 'org-2',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain(
      'Organization ID in URL path does not match x-organization-id header'
    );
  });

  it('should return 404 if organization does not exist', async () => {
    (organizationRepository.findById as jest.Mock).mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/test/non-existent-org',
    });

    expect(res.statusCode).toBe(404);
  });

  it('should return 403 if user is not an active member of the organization', async () => {
    (organizationRepository.findById as jest.Mock).mockResolvedValue({
      id: 'org-1',
      name: 'Test Org',
    });
    (memberRepository.findByUserAndOrganization as jest.Mock).mockResolvedValue(null);

    const res = await app.inject({
      method: 'GET',
      url: '/test/org-1',
    });

    expect(res.statusCode).toBe(403);
  });
});

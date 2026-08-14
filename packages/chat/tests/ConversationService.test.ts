import { ConversationService } from '../src/services/ConversationService';
import { prisma } from '@ion-ai/database';

jest.mock('@ion-ai/database', () => ({
  prisma: {
    conversation: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    message: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(prisma)),
  },
}));

describe('ConversationService', () => {
  let conversationService: ConversationService;

  beforeEach(() => {
    conversationService = new ConversationService();
    jest.clearAllMocks();
  });

  describe('createConversation', () => {
    it('should create a new ACTIVE conversation', async () => {
      (prisma.conversation.create as jest.Mock).mockResolvedValue({
        id: 'conv-123',
        organizationId: 'org-123',
        status: 'ACTIVE',
      });

      const result = await conversationService.createConversation('org-123');
      expect(result.id).toBe('conv-123');
      expect(prisma.conversation.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-123',
          deploymentId: undefined,
          visitorId: undefined,
          status: 'ACTIVE',
        },
      });
    });
  });

  describe('persistMessages', () => {
    it('should run inside a transaction and update lastActivity', async () => {
      await conversationService.persistMessages('conv-123', [{ role: 'user', content: 'Hello' }]);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'conv-123',
          role: 'user',
          content: 'Hello',
        }),
      });
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-123' },
        data: { lastActivity: expect.any(Date) },
      });
    });
  });

  describe('verifyOwnership', () => {
    it('should return conversation when organizationId matches', async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        id: 'conv-1',
        organizationId: 'org-A',
        deploymentId: 'dep-1',
      });

      const result = await conversationService.verifyOwnership('conv-1', 'org-A', 'dep-1');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('conv-1');
    });

    it('should return null when cross-tenant organizationId does not match', async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        id: 'conv-1',
        organizationId: 'org-B',
        deploymentId: 'dep-1',
      });

      const result = await conversationService.verifyOwnership('conv-1', 'org-A', 'dep-1');
      expect(result).toBeNull();
    });

    it('should return null when cross-widget deploymentId does not match', async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue({
        id: 'conv-1',
        organizationId: 'org-A',
        deploymentId: 'dep-2',
      });

      const result = await conversationService.verifyOwnership('conv-1', 'org-A', 'dep-1');
      expect(result).toBeNull();
    });

    it('should return null when conversation does not exist', async () => {
      (prisma.conversation.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await conversationService.verifyOwnership('non-existent', 'org-A');
      expect(result).toBeNull();
    });
  });
});

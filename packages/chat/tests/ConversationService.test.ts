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
});

import { WidgetService } from '../src/services/WidgetService';
import { prisma } from '@ion-ai/database';

jest.mock('@ion-ai/database', () => ({
  prisma: {
    widget: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

describe('WidgetService', () => {
  let widgetService: WidgetService;

  beforeEach(() => {
    widgetService = new WidgetService();
    jest.clearAllMocks();
  });

  describe('generateWidget', () => {
    it('should generate a widget with a random public key', async () => {
      (prisma.widget.create as jest.Mock).mockResolvedValue({
        id: 'widget-123',
        deploymentId: 'dep-123',
        publicKey: 'pk_live_random123',
        allowedDomains: ['example.com'],
        enabled: true,
      });

      const result = await widgetService.generateWidget('dep-123', ['example.com']);

      expect(result.deploymentId).toBe('dep-123');
      expect(result.allowedDomains).toContain('example.com');
      expect(prisma.widget.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateWidgetKey', () => {
    it('should throw an error if widget does not exist', async () => {
      (prisma.widget.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(widgetService.validateWidgetKey('invalid_key')).rejects.toThrow(
        'InvalidWidgetKey'
      );
    });

    it('should throw an error if widget is disabled', async () => {
      (prisma.widget.findUnique as jest.Mock).mockResolvedValue({ enabled: false });

      await expect(widgetService.validateWidgetKey('disabled_key')).rejects.toThrow(
        'InvalidWidgetKey'
      );
    });

    it('should throw an error if origin is not in allowed domains', async () => {
      (prisma.widget.findUnique as jest.Mock).mockResolvedValue({
        enabled: true,
        allowedDomains: ['example.com'],
      });

      await expect(
        widgetService.validateWidgetKey('valid_key', 'https://malicious.com')
      ).rejects.toThrow('InvalidWidgetDomain');
    });

    it('should return widget if validation passes', async () => {
      const mockWidget = {
        enabled: true,
        allowedDomains: ['example.com'],
      };
      (prisma.widget.findUnique as jest.Mock).mockResolvedValue(mockWidget);

      const result = await widgetService.validateWidgetKey('valid_key', 'https://example.com');
      expect(result).toEqual(mockWidget);
    });
  });
});

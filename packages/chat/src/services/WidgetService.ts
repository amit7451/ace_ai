import { prisma } from '@ion-ai/database';
import { Widget } from '@prisma/client';
import crypto from 'crypto';

export class WidgetService {
  async generateWidget(deploymentId: string, allowedDomains: string[] = []) {
    const publicKey = `pk_live_${crypto.randomBytes(24).toString('hex')}`;

    return await prisma.widget.create({
      data: {
        deploymentId,
        publicKey,
        allowedDomains,
        enabled: true,
      },
    });
  }

  async validateWidgetKey(publicKey: string, origin?: string) {
    const widget = await prisma.widget.findUnique({
      where: { publicKey },
      include: { deployment: { include: { organization: true } } },
    });

    if (!widget || !widget.enabled) {
      throw new Error('InvalidWidgetKey');
    }

    if (widget.allowedDomains.length > 0 && origin) {
      const isAllowed = widget.allowedDomains.some((domain) => origin.includes(domain));
      if (!isAllowed) {
        throw new Error('InvalidWidgetDomain');
      }
    }

    return widget;
  }
}

export const widgetService = new WidgetService();

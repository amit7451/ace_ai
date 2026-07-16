import { widgetRepository } from '../repositories/WidgetRepository';
import crypto from 'crypto';

export class WidgetService {
  async generateWidget(deploymentId: string, allowedDomains: string[] = []) {
    const publicKey = `pk_live_${crypto.randomBytes(24).toString('hex')}`;

    return await widgetRepository.create({
      deploymentId,
      publicKey,
      allowedDomains,
      enabled: true,
    });
  }

  async validateWidgetKey(publicKey: string, origin?: string) {
    const widget = await widgetRepository.findByPublicKeyWithDetails(publicKey);

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

  async getWidgetsByDeployment(deploymentId: string) {
    return widgetRepository.findManyByDeploymentId(deploymentId);
  }
}

export const widgetService = new WidgetService();

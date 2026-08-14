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
      let hostname: string;
      try {
        hostname = new URL(origin).hostname.toLowerCase();
      } catch {
        throw new Error('InvalidWidgetDomain');
      }

      const isAllowed = widget.allowedDomains.some((rawDomain) => {
        let domain = rawDomain.trim().toLowerCase();
        if (!domain) return false;

        if (domain.startsWith('http://') || domain.startsWith('https://')) {
          try {
            domain = new URL(domain).hostname.toLowerCase();
          } catch {
            // fallback if URL parse fails
          }
        }

        if (domain.startsWith('*.')) {
          domain = domain.slice(2);
        } else if (domain.startsWith('.')) {
          domain = domain.slice(1);
        }

        if (domain.includes(':')) {
          domain = domain.split(':')[0];
        }

        return hostname === domain || hostname.endsWith('.' + domain);
      });

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

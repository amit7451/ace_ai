import Redis from 'ioredis';
import { env } from '@ion-ai/config';

const redis = new Redis({
  host: env.REDIS_HOST,
  port: parseInt(env.REDIS_PORT),
  password: env.REDIS_PASSWORD,
});

export class RateLimitService {
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
    errorContext?: {
      keySource?: 'SYSTEM_FREE_TIER' | 'ORGANIZATION_CUSTOM_KEY';
      isGlobal?: boolean;
    }
  ): Promise<void> {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }

    if (current > limit) {
      const ttl = await redis.ttl(key);
      const retryAfterSeconds = ttl > 0 ? ttl : windowSeconds;
      const keySource = errorContext?.keySource || 'SYSTEM_FREE_TIER';
      const isGlobal = !!errorContext?.isGlobal;

      const err = new Error(
        isGlobal
          ? 'Global shared API key rate limit exceeded. Please wait or configure your own API key.'
          : 'Rate limit exceeded for organization.'
      );

      throw Object.assign(err, {
        statusCode: 429,
        retryAfterMs: retryAfterSeconds * 1000,
        keySource,
        isGlobalSharedKey: isGlobal,
      });
    }
  }

  async checkWidgetLimit(widgetId: string) {
    await this.checkRateLimit(`ratelimit:widget:${widgetId}`, 100, 60); // 100 requests per minute per widget
  }

  async checkVisitorLimit(visitorId: string) {
    await this.checkRateLimit(`ratelimit:visitor:${visitorId}`, 20, 60); // 20 requests per minute per visitor
  }

  async checkOrganizationLimit(orgId: string) {
    await this.checkRateLimit(`ratelimit:org:${orgId}`, 500, 60, {
      keySource: 'SYSTEM_FREE_TIER',
    }); // 500 requests per minute per org
  }

  async checkGlobalSharedKeyLimit() {
    await this.checkRateLimit(`ratelimit:global:shared_key`, 2000, 60, {
      keySource: 'SYSTEM_FREE_TIER',
      isGlobal: true,
    }); // 2000 requests per minute globally for shared key
  }
}

export const rateLimitService = new RateLimitService();

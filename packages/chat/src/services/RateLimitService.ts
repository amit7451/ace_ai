import Redis from 'ioredis';
import { env } from '@ion-ai/config';

const redis = new Redis({
  host: env.REDIS_HOST,
  port: typeof env.REDIS_PORT === 'number' ? env.REDIS_PORT : parseInt(String(env.REDIS_PORT)),
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
          ? 'Global shared AI service rate limit reached. Please retry in a few moments or configure your own API key in Settings.'
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
    await this.checkRateLimit(`ratelimit:widget:${widgetId}`, env.WIDGET_RPM_LIMIT, 60);
  }

  async checkVisitorLimit(visitorId: string) {
    await this.checkRateLimit(`ratelimit:visitor:${visitorId}`, env.VISITOR_RPM_LIMIT, 60);
  }

  async checkOrganizationLimit(orgId: string) {
    await this.checkRateLimit(`ratelimit:org:${orgId}`, env.ORGANIZATION_FREE_TIER_RPM_LIMIT, 60, {
      keySource: 'SYSTEM_FREE_TIER',
    });
  }

  async checkGlobalSharedKeyLimit() {
    await this.checkRateLimit(`ratelimit:global:shared_key`, env.GLOBAL_SHARED_KEY_RPM_LIMIT, 60, {
      keySource: 'SYSTEM_FREE_TIER',
      isGlobal: true,
    });
  }

  async checkDailyFreeTierLimit(
    orgId: string,
    dailyLimit: number = env.DAILY_FREE_TIER_REQUEST_LIMIT
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const key = `ratelimit:org:daily_free_tier:${orgId}:${today}`;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 86400 * 2); // 48h TTL
    }

    if (current > dailyLimit) {
      const ttl = await redis.ttl(key);
      const retryAfterSeconds = ttl > 0 ? ttl : 3600;
      const err = new Error(
        `Daily free tier quota exceeded (${dailyLimit} requests/day). Please configure your own API key in Settings.`
      );
      throw Object.assign(err, {
        statusCode: 429,
        retryAfterMs: retryAfterSeconds * 1000,
        keySource: 'SYSTEM_FREE_TIER',
        isDailyQuotaExceeded: true,
      });
    }
  }
}

export const rateLimitService = new RateLimitService();

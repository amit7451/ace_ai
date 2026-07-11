import Redis from 'ioredis';
import { env } from '@ion-ai/config';

// Re-using the Redis instance configured in config
const redis = new Redis({
  host: env.REDIS_HOST,
  port: parseInt(env.REDIS_PORT),
  password: env.REDIS_PASSWORD,
});

export class RateLimitService {
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    if (current > limit) {
      throw Object.assign(new Error('RateLimitExceeded'), { statusCode: 429 });
    }
  }

  async checkWidgetLimit(widgetId: string) {
    await this.checkRateLimit(`ratelimit:widget:${widgetId}`, 100, 60); // 100 requests per minute per widget
  }

  async checkVisitorLimit(visitorId: string) {
    await this.checkRateLimit(`ratelimit:visitor:${visitorId}`, 20, 60); // 20 requests per minute per visitor
  }

  async checkOrganizationLimit(orgId: string) {
    await this.checkRateLimit(`ratelimit:org:${orgId}`, 500, 60); // 500 requests per minute per org
  }
}

export const rateLimitService = new RateLimitService();

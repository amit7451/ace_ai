import { z } from 'zod';

export const memoryProviderSchema = z.enum(['in-memory', 'redis']);

export const memoryConfigSchema = z.object({
  provider: memoryProviderSchema.default('in-memory'),
  /** Optional TTL in seconds for how long to persist session memory. */
  ttlSeconds: z.number().int().positive().optional(),
});

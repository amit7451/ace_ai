import { z } from 'zod';

export const VECTOR_STORE_PROVIDER_NAMES = ['qdrant'] as const;
export const DISTANCE_METRICS = ['cosine', 'euclid', 'dot', 'manhattan'] as const;

/**
 * Validates `VectorStoreConfig` before a provider is constructed.
 * `VectorStoreProviderFactory.create()` is the only place this runs —
 * concrete providers assume they've already received valid config.
 */
export const vectorStoreConfigSchema = z.object({
  provider: z.enum(VECTOR_STORE_PROVIDER_NAMES),
  url: z.string().url(),
  apiKey: z.string().optional(),
  timeout: z.number().int().positive().optional(),
  maxRetries: z.number().int().min(0).optional(),
  maxBatchSize: z.number().int().positive().optional(),
});

/**
 * Validates `CreateCollectionConfig`. Not called automatically by
 * `createCollection()` — exported so callers (e.g. Component 4's indexing
 * pipeline, or a dashboard API route) can validate user/tenant-supplied
 * input at the boundary, before it ever reaches this package.
 */
export const createCollectionConfigSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Collection name must contain only letters, numbers, "_" and "-"'),
  vectorSize: z.number().int().positive(),
  distance: z.enum(DISTANCE_METRICS).optional(),
  onDiskPayload: z.boolean().optional(),
  recreateIfExists: z.boolean().optional(),
});

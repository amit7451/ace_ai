import { z } from 'zod';

export const RERANK_STRATEGY_NAMES = ['similarity-threshold', 'mmr'] as const;
export const rerankStrategyNameSchema = z.enum(RERANK_STRATEGY_NAMES);

const matchValueSchema = z.union([z.string(), z.number(), z.boolean()]);

/**
 * Structural validation for Component 3's `FilterCondition`/`VectorFilter`
 * DSL. Neither Component 3 nor Component 4 validates this shape at
 * runtime (they only ever receive it from trusted internal TypeScript
 * code) — this is the first layer where a `filter` is realistically
 * user/API-supplied (a chat request's metadata filter), so it gets real
 * validation here rather than a `z.any()` pass-through.
 */
const filterConditionSchema = z.object({
  key: z.string().min(1),
  match: z
    .union([z.object({ value: matchValueSchema }), z.object({ any: z.array(matchValueSchema) })])
    .optional(),
  range: z
    .object({
      gt: z.number().optional(),
      gte: z.number().optional(),
      lt: z.number().optional(),
      lte: z.number().optional(),
    })
    .optional(),
});

export const vectorFilterSchema = z.object({
  must: z.array(filterConditionSchema).optional(),
  should: z.array(filterConditionSchema).optional(),
  mustNot: z.array(filterConditionSchema).optional(),
});

/** Validates `RetrieverConfig` before a `RagRetriever` is constructed. */
export const retrieverConfigSchema = z.object({
  collection: z.string().min(1, 'collection is required'),
  topK: z.number().int().positive().default(5),
  scoreThreshold: z.number().default(0.5),
  strategy: rerankStrategyNameSchema.default('similarity-threshold'),
  maxContextTokens: z.number().int().positive().optional(),
  mmrLambda: z.number().min(0).max(1).default(0.5),
});

/** Validates a `RetrievalQuery` on every `retrieve()` call. */
export const retrievalQuerySchema = z.object({
  query: z.string().trim().min(1, 'query must not be empty'),
  tenantId: z.string().min(1, 'tenantId is required'),
  assistantId: z.string().min(1, 'assistantId is required'),
  topK: z.number().int().positive().optional(),
  scoreThreshold: z.number().optional(),
  filter: vectorFilterSchema.optional(),
  maxContextTokens: z.number().int().positive().optional(),
});

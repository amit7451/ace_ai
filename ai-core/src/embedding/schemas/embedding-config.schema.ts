import { z } from 'zod';

export const EMBEDDING_PROVIDER_NAMES = ['openai', 'gemini', 'cohere', 'ollama'] as const;
export const EMBEDDING_INPUT_TYPES = ['document', 'query', 'clustering', 'classification'] as const;

export const embeddingConfigSchema = z
  .object({
    provider: z.enum(EMBEDDING_PROVIDER_NAMES),
    apiKey: z.string().min(1).optional(),
    model: z.string().min(1, 'model is required'),
    baseUrl: z.string().url().optional(),
    dimensions: z.number().int().positive().optional(),
    maxRetries: z.number().int().min(0).max(10).default(3),
    timeoutMs: z.number().int().min(1000).max(120_000).default(30_000),
    maxBatchSize: z.number().int().positive().optional(),
    defaultInputType: z.enum(EMBEDDING_INPUT_TYPES).default('document'),
  })
  .superRefine((val, ctx) => {
    if (val.provider !== 'ollama' && !val.apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"apiKey" is required for embedding provider "${val.provider}" (only "ollama" runs without one).`,
        path: ['apiKey'],
      });
    }
  });

export type EmbeddingConfigInput = z.input<typeof embeddingConfigSchema>;
export type EmbeddingConfigParsed = z.output<typeof embeddingConfigSchema>;

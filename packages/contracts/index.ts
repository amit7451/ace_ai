import { z } from 'zod';

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
});

export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  organizationName: z.string().min(1),
});

export const CreateOrganizationRequestSchema = z.object({
  name: z.string().min(1),
});

export const UpdateOrganizationConfigurationSchema = z.object({
  llmProvider: z.string().optional(),
  embeddingProvider: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).optional(),
  topK: z.number().int().min(1).max(20).optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
  systemPrompt: z.string().optional(),
  welcomeMessage: z.string().optional(),
});

export const SaveApiKeyRequestSchema = z.object({
  provider: z.string(),
  apiKey: z.string().min(1),
});

export type SaveApiKeyRequest = z.infer<typeof SaveApiKeyRequestSchema>;

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequestSchema>;
export type UpdateOrganizationConfigurationRequest = z.infer<
  typeof UpdateOrganizationConfigurationSchema
>;

// -----------------------------------------
// Crawler
// -----------------------------------------

/**
 * A path pattern used for includePaths/excludePaths: matched against a
 * URL's pathname only (not the query string). `*` matches within one path
 * segment, `**` matches across segments — e.g. `/docs/**` matches
 * `/docs/2024/setup`, `/docs/*` does not.
 */
const PathPatternSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((p) => p.startsWith('/'), { message: 'Path patterns must start with "/"' });

export const CreateCrawlJobRequestSchema = z.object({
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith('http://') || u.startsWith('https://'), {
      message: 'URL must use http or https.',
    }),
  maxPages: z.number().int().min(1).max(500).optional(),
  maxDepth: z.number().int().min(0).max(10).optional(),
  includePaths: z.array(PathPatternSchema).max(50).optional(),
  excludePaths: z.array(PathPatternSchema).max(50).optional(),
  respectRobotsTxt: z.boolean().optional(),
  sameOriginOnly: z.boolean().optional(),
});

export type CreateCrawlJobRequest = z.infer<typeof CreateCrawlJobRequestSchema>;

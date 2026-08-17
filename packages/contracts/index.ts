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
  llmModel: z.string().optional(),
  embeddingProvider: z.string().optional(),
  embeddingModel: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).optional(),
  topK: z.number().int().min(1).max(20).optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
  systemPrompt: z.string().optional(),
  welcomeMessage: z.string().optional(),
  institutionName: z.string().optional(),
  supportEmail: z.string().email().optional().or(z.literal('')),
  supportWebsite: z.string().url().optional().or(z.literal('')),
  supportPhone: z.string().optional(),
  introductoryMessage: z.string().optional(),
});

export const AvailableModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});
export type AvailableModel = z.infer<typeof AvailableModelSchema>;

export const AvailableModelsResponseSchema = z.object({
  provider: z.string(),
  type: z.enum(['llm', 'embedding']),
  models: z.array(AvailableModelSchema),
  live: z.boolean(),
});
export type AvailableModelsResponse = z.infer<typeof AvailableModelsResponseSchema>;

export type KeySourceType = 'SYSTEM_FREE_TIER' | 'ORGANIZATION_CUSTOM_KEY' | 'NONE';

export const InstitutionSupportSchema = z.object({
  institutionName: z.string().optional(),
  supportEmail: z.string().optional(),
  supportWebsite: z.string().optional(),
  supportPhone: z.string().optional(),
  introductoryMessage: z.string().optional(),
});

export type InstitutionSupportInfo = z.infer<typeof InstitutionSupportSchema>;

export const AIErrorCategorySchema = z.enum([
  'FREE_TIER_QUOTA',
  'GLOBAL_SHARED_KEY_QUOTA',
  'CUSTOM_KEY_QUOTA',
  'RATE_LIMIT',
  'AUTHENTICATION',
  'CONTEXT_LIMIT',
  'PROVIDER_DOWN',
  'EMBEDDING',
  'MODERATION',
  'UNKNOWN',
]);

export const AIErrorActionTypeSchema = z.enum([
  'NAVIGATE_TO_SETTINGS',
  'UPDATE_CUSTOM_KEY',
  'CONTACT_ADMINISTRATOR',
  'WAIT_AND_RETRY',
  'UPGRADE_PROVIDER_PLAN',
  'TRUNCATE_HISTORY',
  'RETRY_NOW',
  'DISMISS',
]);

export type AIErrorCategory = z.infer<typeof AIErrorCategorySchema>;
export type AIErrorActionType = z.infer<typeof AIErrorActionTypeSchema>;

export const StructuredAIErrorSchema = z.object({
  code: z.string(),
  category: AIErrorCategorySchema,
  message: z.string(),
  keySource: z.enum(['SYSTEM_FREE_TIER', 'ORGANIZATION_CUSTOM_KEY', 'NONE']),
  provider: z.string(),
  retryAfterSeconds: z.number().optional(),
  resetTimestamp: z.string().optional(),
  institutionSupport: InstitutionSupportSchema.optional(),
  actionableResolution: z.object({
    type: AIErrorActionTypeSchema,
    title: z.string(),
    description: z.string(),
    primaryButton: z.object({
      label: z.string(),
      action: AIErrorActionTypeSchema,
      targetUrl: z.string().optional(),
    }),
    secondaryButton: z
      .object({
        label: z.string(),
        action: AIErrorActionTypeSchema,
        targetUrl: z.string().optional(),
      })
      .optional(),
  }),
  details: z.record(z.any()).optional(),
});

export type StructuredAIError = z.infer<typeof StructuredAIErrorSchema>;

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
  sameOriginOnly: z
    .boolean()
    .refine((val) => val === true, {
      message:
        'Cross-origin crawling is disabled for security and cost protection. sameOriginOnly must be true.',
    })
    .default(true),
});

export type CreateCrawlJobRequest = z.infer<typeof CreateCrawlJobRequestSchema>;

// -----------------------------------------
// Knowledge Search
// -----------------------------------------

export const SearchKnowledgeRequestSchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(50).optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
});

export type SearchKnowledgeRequest = z.infer<typeof SearchKnowledgeRequestSchema>;

export const SearchKnowledgeChunkSchema = z.object({
  chunkId: z.string(),
  documentId: z.string().optional(),
  text: z.string(),
  score: z.number(),
  tokenCount: z.number().optional(),
  sourceType: z.string().optional(),
  sourceUrl: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const SearchKnowledgeResponseSchema = z.object({
  chunks: z.array(SearchKnowledgeChunkSchema),
  totalCandidateCount: z.number().optional(),
  returnedChunkCount: z.number().optional(),
  totalTokenCount: z.number().optional(),
  durationMs: z.number().optional(),
  query: z.string(),
});

export type SearchKnowledgeResponse = z.infer<typeof SearchKnowledgeResponseSchema>;

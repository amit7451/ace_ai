import { z } from 'zod';

export const LLM_PROVIDER_NAMES = ['openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'ollama'] as const;

export const LLMProviderNameSchema = z.enum(LLM_PROVIDER_NAMES);

export const LLMProviderConfigSchema = z
  .object({
    provider: LLMProviderNameSchema,
    apiKey: z.string().min(1).optional(),
    baseUrl: z.string().url().optional(),
    model: z.string().min(1, 'model is required'),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().optional(),
    timeoutMs: z.number().int().positive().optional(),
    maxRetries: z.number().int().min(0).max(10).optional(),
    retryBaseDelayMs: z.number().int().positive().optional(),
    retryMaxDelayMs: z.number().int().positive().optional(),
    organization: z.string().optional(),
    extraHeaders: z.record(z.string()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.provider !== 'ollama' && !data.apiKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `apiKey is required for provider "${data.provider}"`,
        path: ['apiKey'],
      });
    }
  });

export type LLMProviderConfigInput = z.input<typeof LLMProviderConfigSchema>;
export type LLMProviderConfigParsed = z.output<typeof LLMProviderConfigSchema>;

export function parseLLMProviderConfig(input: unknown): LLMProviderConfigParsed {
  return LLMProviderConfigSchema.parse(input);
}

export function safeParseLLMProviderConfig(input: unknown) {
  return LLMProviderConfigSchema.safeParse(input);
}

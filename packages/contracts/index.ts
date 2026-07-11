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
});

export const CreateOrganizationRequestSchema = z.object({
  name: z.string().min(1),
});

export const UpdateOrganizationConfigurationSchema = z.object({
  llmProvider: z.string().optional(),
  embeddingProvider: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  systemPrompt: z.string().optional(),
  welcomeMessage: z.string().optional(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequestSchema>;
export type UpdateOrganizationConfigurationRequest = z.infer<
  typeof UpdateOrganizationConfigurationSchema
>;

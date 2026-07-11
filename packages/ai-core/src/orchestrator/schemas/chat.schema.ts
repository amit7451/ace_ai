import { z } from 'zod';

export const chatRequestSchema = z.object({
  tenantId: z.string().min(1, 'tenantId is required'),
  assistantId: z.string().min(1, 'assistantId is required'),
  sessionId: z.string().min(1, 'sessionId is required'),
  query: z.string().min(1, 'query cannot be empty'),
});

import { z } from 'zod';

export const KNOWLEDGE_DOCUMENT_FORMATS = ['plain-text', 'markdown', 'html', 'csv'] as const;
export const CHUNKING_STRATEGY_NAMES = [
  'fixed-size',
  'recursive',
  'markdown-aware',
  'csv-row',
] as const;
export const KNOWLEDGE_SOURCE_TYPES = [
  'document',
  'website',
  'faq',
  'policy',
  'manual',
  'other',
] as const;

/** Base shape without the cross-field refinement — reused so the outer config can accept a *partial* override of it. */
const chunkingOptionsBaseSchema = z.object({
  maxChunkSize: z.number().int().positive().default(1000),
  chunkOverlap: z.number().int().min(0).default(150),
  rowsPerChunk: z.number().int().positive().optional(),
});

/** Full validation, including the overlap-vs-maxChunkSize check — applied to the *resolved* (post-merge) options, never to a raw partial override. */
export const chunkingOptionsSchema = chunkingOptionsBaseSchema.superRefine((val, ctx) => {
  if (val.chunkOverlap >= val.maxChunkSize) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'chunkOverlap must be smaller than maxChunkSize.',
      path: ['chunkOverlap'],
    });
  }
});

export const knowledgeProcessingConfigSchema = z.object({
  format: z.enum(KNOWLEDGE_DOCUMENT_FORMATS).optional(),
  strategy: z.enum(CHUNKING_STRATEGY_NAMES).optional(),
  chunking: chunkingOptionsBaseSchema.partial().optional(),
  sourceType: z.enum(KNOWLEDGE_SOURCE_TYPES).optional(),
  tenantId: z.string().min(1, 'tenantId is required'),
  assistantId: z.string().min(1, 'assistantId is required'),
  documentId: z.string().min(1, 'documentId is required'),
});

export type ChunkingOptionsParsed = z.output<typeof chunkingOptionsSchema>;
export type KnowledgeProcessingConfigParsed = z.output<typeof knowledgeProcessingConfigSchema>;

import { z } from 'zod';
import { promptConfigSchema } from '../schemas/prompt-config.schema';

/**
 * What the caller passes to the `RagPromptBuilder` constructor.
 * Only `systemPrompt` is mandatory — every other field has a sensible
 * default defined in the Zod schema.
 */
export type PromptConfig = z.input<typeof promptConfigSchema>;

/**
 * The fully resolved config after Zod defaults have been applied.
 * Used internally by `RagPromptBuilder`.
 */
export type ResolvedPromptConfig = z.output<typeof promptConfigSchema>;

/** The set of supported fallback strategies (string-literal union). */
export type FallbackStrategy = z.infer<typeof promptConfigSchema>['fallbackStrategy'];

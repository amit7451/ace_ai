import { z } from 'zod';
import { memoryConfigSchema } from '../schemas/memory-config.schema';

export type MemoryProviderName = z.infer<typeof memoryConfigSchema>['provider'];

export type MemoryConfig = z.input<typeof memoryConfigSchema>;
export type ResolvedMemoryConfig = z.output<typeof memoryConfigSchema>;

import type { IMemoryProvider } from '../interfaces/memory-provider.interface';
import type { MemoryConfig, ResolvedMemoryConfig } from '../types/memory-config.types';
import { memoryConfigSchema } from '../schemas/memory-config.schema';
import { InMemoryMemoryProvider } from '../providers/in-memory/in-memory.provider';
import { MemoryProviderError } from '../errors/memory.errors';

export class MemoryProviderFactory {
  static create(config: MemoryConfig): IMemoryProvider {
    const resolved: ResolvedMemoryConfig = memoryConfigSchema.parse(config);

    switch (resolved.provider) {
      case 'in-memory':
        return new InMemoryMemoryProvider(resolved);
      case 'redis':
        throw new MemoryProviderError(
          'Redis provider not yet implemented. Use in-memory for MVP.',
          'redis'
        );
      default:
        throw new MemoryProviderError(
          `Unsupported memory provider: "${resolved.provider}".`,
          resolved.provider
        );
    }
  }
}

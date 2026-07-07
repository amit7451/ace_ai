import { ChunkingStrategyName, ChunkingOptions } from '../../types/knowledge-config.types';
import { ParsedDocument } from '../../types/knowledge-document.types';
import { ChunkedText } from '../../types/knowledge-chunk.types';
import { IChunkingStrategy } from '../../interfaces/chunking-strategy.interface';
import { KnowledgeInvalidConfigError } from '../../errors/knowledge.errors';

/**
 * Shared options validation for every chunking algorithm — same "raw*"
 * delegation pattern as `BaseDocumentParser` and Components 1-3's base
 * providers. Concrete strategies only implement `rawChunk`, guaranteed to
 * receive already-validated options.
 */
export abstract class BaseChunkingStrategy implements IChunkingStrategy {
  abstract readonly name: ChunkingStrategyName;

  chunk(parsed: ParsedDocument, options: ChunkingOptions): ChunkedText[] {
    this.validateOptions(options);
    return this.rawChunk(parsed, options);
  }

  protected validateOptions(options: ChunkingOptions): void {
    if (!Number.isInteger(options.maxChunkSize) || options.maxChunkSize <= 0) {
      throw new KnowledgeInvalidConfigError('maxChunkSize must be a positive integer.');
    }
    if (!Number.isInteger(options.chunkOverlap) || options.chunkOverlap < 0) {
      throw new KnowledgeInvalidConfigError('chunkOverlap must be a non-negative integer.');
    }
    if (options.chunkOverlap >= options.maxChunkSize) {
      throw new KnowledgeInvalidConfigError('chunkOverlap must be smaller than maxChunkSize.');
    }
  }

  protected abstract rawChunk(parsed: ParsedDocument, options: ChunkingOptions): ChunkedText[];
}

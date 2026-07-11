import { ChunkingStrategyName } from '../types/knowledge-config.types';
import { IChunkingStrategy } from '../interfaces/chunking-strategy.interface';
import { FixedSizeChunkingStrategy } from '../chunking/fixed-size/fixed-size-chunking.strategy';
import { RecursiveChunkingStrategy } from '../chunking/recursive/recursive-chunking.strategy';
import { MarkdownAwareChunkingStrategy } from '../chunking/markdown-aware/markdown-aware-chunking.strategy';
import { CsvRowChunkingStrategy } from '../chunking/csv-row/csv-row-chunking.strategy';
import { KnowledgeUnsupportedStrategyError } from '../errors/knowledge.errors';

/**
 * The only place that knows about concrete chunking strategy classes.
 * Same extensibility story as `DocumentParserFactory`.
 */
export class ChunkingStrategyFactory {
  static create(name: ChunkingStrategyName): IChunkingStrategy {
    switch (name) {
      case 'fixed-size':
        return new FixedSizeChunkingStrategy();
      case 'recursive':
        return new RecursiveChunkingStrategy();
      case 'markdown-aware':
        return new MarkdownAwareChunkingStrategy();
      case 'csv-row':
        return new CsvRowChunkingStrategy();
      default: {
        const exhaustiveCheck: never = name;
        throw new KnowledgeUnsupportedStrategyError(String(exhaustiveCheck));
      }
    }
  }
}

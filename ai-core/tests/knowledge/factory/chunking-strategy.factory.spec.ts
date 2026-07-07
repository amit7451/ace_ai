import { ChunkingStrategyFactory } from '../../../src/knowledge/factory/chunking-strategy.factory';
import { FixedSizeChunkingStrategy } from '../../../src/knowledge/chunking/fixed-size/fixed-size-chunking.strategy';
import { RecursiveChunkingStrategy } from '../../../src/knowledge/chunking/recursive/recursive-chunking.strategy';
import { MarkdownAwareChunkingStrategy } from '../../../src/knowledge/chunking/markdown-aware/markdown-aware-chunking.strategy';
import { CsvRowChunkingStrategy } from '../../../src/knowledge/chunking/csv-row/csv-row-chunking.strategy';

describe('ChunkingStrategyFactory', () => {
  it('creates a FixedSizeChunkingStrategy', () => {
    expect(ChunkingStrategyFactory.create('fixed-size')).toBeInstanceOf(FixedSizeChunkingStrategy);
  });

  it('creates a RecursiveChunkingStrategy', () => {
    expect(ChunkingStrategyFactory.create('recursive')).toBeInstanceOf(RecursiveChunkingStrategy);
  });

  it('creates a MarkdownAwareChunkingStrategy', () => {
    expect(ChunkingStrategyFactory.create('markdown-aware')).toBeInstanceOf(MarkdownAwareChunkingStrategy);
  });

  it('creates a CsvRowChunkingStrategy', () => {
    expect(ChunkingStrategyFactory.create('csv-row')).toBeInstanceOf(CsvRowChunkingStrategy);
  });

  it('throws for an unsupported strategy name', () => {
    expect(() => ChunkingStrategyFactory.create('semantic' as never)).toThrow();
  });
});

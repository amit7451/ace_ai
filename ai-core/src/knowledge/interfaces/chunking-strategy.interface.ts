import { ChunkingStrategyName, ChunkingOptions } from '../types/knowledge-config.types';
import { ParsedDocument } from '../types/knowledge-document.types';
import { ChunkedText } from '../types/knowledge-chunk.types';

/**
 * The contract every chunking algorithm implements. `ChunkingStrategyFactory`
 * is the only place that knows about concrete strategy classes.
 */
export interface IChunkingStrategy {
  readonly name: ChunkingStrategyName;
  chunk(parsed: ParsedDocument, options: ChunkingOptions): ChunkedText[];
}

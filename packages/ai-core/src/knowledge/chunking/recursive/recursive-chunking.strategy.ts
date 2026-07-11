import { ChunkingOptions } from '../../types/knowledge-config.types';
import { ParsedDocument } from '../../types/knowledge-document.types';
import { ChunkedText } from '../../types/knowledge-chunk.types';
import { BaseChunkingStrategy } from '../base/base-chunking-strategy';
import { splitRecursively } from '../../utils/recursive-splitter';

/**
 * The general-purpose default. Splits on paragraph breaks first, falling
 * back to lines, then sentences, then words only where a piece is still
 * too large — keeping chunks close to natural boundaries instead of
 * cutting at an arbitrary character offset (`fixed-size`'s behavior).
 */
export class RecursiveChunkingStrategy extends BaseChunkingStrategy {
  readonly name = 'recursive' as const;

  protected rawChunk(parsed: ParsedDocument, options: ChunkingOptions): ChunkedText[] {
    return splitRecursively(parsed.text, options.maxChunkSize, options.chunkOverlap)
      .map((text) => ({ text: text.trim() }))
      .filter((c) => c.text.length > 0);
  }
}

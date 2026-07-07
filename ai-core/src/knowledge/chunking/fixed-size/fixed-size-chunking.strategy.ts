import { ChunkingOptions } from '../../types/knowledge-config.types';
import { ParsedDocument } from '../../types/knowledge-document.types';
import { ChunkedText } from '../../types/knowledge-chunk.types';
import { BaseChunkingStrategy } from '../base/base-chunking-strategy';

const WORD_BOUNDARY_LOOKBACK_RATIO = 0.2;
const MAX_WORD_BOUNDARY_LOOKBACK = 40;

/**
 * The simplest strategy: fixed-size sliding windows over the raw text with
 * a configurable overlap. Makes a best effort not to cut a word in half by
 * backing up to the nearest whitespace within a small lookback window, but
 * otherwise ignores document structure entirely — use `recursive` or
 * `markdown-aware` when boundary quality matters more than predictability.
 */
export class FixedSizeChunkingStrategy extends BaseChunkingStrategy {
  readonly name = 'fixed-size' as const;

  protected rawChunk(parsed: ParsedDocument, options: ChunkingOptions): ChunkedText[] {
    const { maxChunkSize, chunkOverlap } = options;
    const text = parsed.text;
    const chunks: ChunkedText[] = [];

    let start = 0;
    while (start < text.length) {
      const hardEnd = Math.min(start + maxChunkSize, text.length);
      let actualEnd = hardEnd;

      if (hardEnd < text.length) {
        const lookback = Math.min(MAX_WORD_BOUNDARY_LOOKBACK, Math.floor(maxChunkSize * WORD_BOUNDARY_LOOKBACK_RATIO));
        const windowStart = Math.max(start, hardEnd - lookback);
        const window = text.slice(windowStart, hardEnd);
        const lastSpace = window.lastIndexOf(' ');
        if (lastSpace !== -1) {
          actualEnd = windowStart + lastSpace;
        }
      }

      const piece = text.slice(start, actualEnd).trim();
      if (piece) chunks.push({ text: piece });

      if (actualEnd >= text.length) break;
      // Strictly-increasing start guarantees termination regardless of chunkOverlap's value relative to the actual advance made.
      start = Math.max(actualEnd - chunkOverlap, start + 1);
    }

    return chunks;
  }
}

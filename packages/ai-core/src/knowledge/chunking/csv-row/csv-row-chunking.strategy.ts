import { ChunkingOptions } from '../../types/knowledge-config.types';
import { ParsedDocument } from '../../types/knowledge-document.types';
import { ChunkedText } from '../../types/knowledge-chunk.types';
import { BaseChunkingStrategy } from '../base/base-chunking-strategy';
import { splitRecursively } from '../../utils/recursive-splitter';

/**
 * Groups CSV data rows (using `CsvParser`'s structural hints) into chunks
 * of `rowsPerChunk` rows each — default 1, since a single CSV row is
 * usually a self-contained fact (one FAQ entry, one price line, one policy
 * clause) and merging unrelated rows into the same chunk hurts retrieval
 * precision more than it helps. Falls back to plain `recursive` chunking
 * if no CSV row structure is available.
 */
export class CsvRowChunkingStrategy extends BaseChunkingStrategy {
  readonly name = 'csv-row' as const;

  protected rawChunk(parsed: ParsedDocument, options: ChunkingOptions): ChunkedText[] {
    const rows = parsed.structure?.csvRows;

    if (!rows || rows.length === 0) {
      return splitRecursively(parsed.text, options.maxChunkSize, options.chunkOverlap)
        .map((text) => ({ text: text.trim() }))
        .filter((c) => c.text.length > 0);
    }

    const rowsPerChunk = Math.max(options.rowsPerChunk ?? 1, 1);
    const chunks: ChunkedText[] = [];

    for (let i = 0; i < rows.length; i += rowsPerChunk) {
      const group = rows.slice(i, i + rowsPerChunk);
      const text = group
        .map((row) =>
          Object.entries(row.record)
            .map(([key, value]) => `${key}: ${value}`)
            .join(' | ')
        )
        .join('\n')
        .trim();

      if (!text) continue;
      chunks.push({
        text,
        metadata: { rowRange: [group[0].index, group[group.length - 1].index] },
      });
    }

    return chunks;
  }
}

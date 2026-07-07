import { ChunkingOptions } from '../../types/knowledge-config.types';
import { ParsedDocument } from '../../types/knowledge-document.types';
import { ChunkedText } from '../../types/knowledge-chunk.types';
import { BaseChunkingStrategy } from '../base/base-chunking-strategy';
import { splitRecursively } from '../../utils/recursive-splitter';

/**
 * Splits by markdown header first (using `MarkdownParser`'s structural
 * hints), prefixing each resulting chunk with its header breadcrumb (e.g.
 * "Getting Started > Installation") so the embedded text carries section
 * context — a well-known RAG quality improvement over chunking raw prose
 * with headers stripped out. Falls back to plain `recursive` chunking over
 * the whole text if no markdown structure is available (e.g. this strategy
 * was pointed at a document parsed by a non-markdown parser).
 */
export class MarkdownAwareChunkingStrategy extends BaseChunkingStrategy {
  readonly name = 'markdown-aware' as const;

  protected rawChunk(parsed: ParsedDocument, options: ChunkingOptions): ChunkedText[] {
    const sections = parsed.structure?.markdownSections;

    if (!sections || sections.length === 0) {
      return splitRecursively(parsed.text, options.maxChunkSize, options.chunkOverlap)
        .map((text) => ({ text: text.trim() }))
        .filter((c) => c.text.length > 0);
    }

    const chunks: ChunkedText[] = [];

    for (const section of sections) {
      const headerPrefix = section.headerPath.length ? `${section.headerPath.join(' > ')}\n` : '';
      // Reserve room for the header prefix so the *whole* chunk (prefix + body) stays within maxChunkSize.
      const bodyBudget = Math.max(options.maxChunkSize - headerPrefix.length, Math.floor(options.maxChunkSize / 2));

      const pieces = splitRecursively(section.content, bodyBudget, options.chunkOverlap);

      for (const piece of pieces) {
        const text = `${headerPrefix}${piece}`.trim();
        if (!text) continue;
        chunks.push({
          text,
          metadata: section.headerPath.length ? { headerPath: section.headerPath } : undefined,
        });
      }
    }

    return chunks;
  }
}

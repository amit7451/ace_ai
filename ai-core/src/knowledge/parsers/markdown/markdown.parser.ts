import { RawDocumentInput, ParsedDocument, MarkdownSection } from '../../types/knowledge-document.types';
import { BaseDocumentParser } from '../base/base-document-parser';
import { normalizeWhitespace } from '../../utils/text-cleaning';

interface RawHeaderLine {
  level: number;
  title: string;
  lineIndex: number;
}

/**
 * Strips the common CommonMark subset — emphasis, links, images, inline
 * code, code fences, blockquotes, list markers — down to plain text.
 * Deliberately not a full CommonMark parser (no tables, no nested list
 * indentation semantics, no footnotes); good enough to turn prose-heavy
 * documentation into clean embeddable text without pulling in a markdown
 * AST library.
 */
function stripMarkdownSyntax(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, '').trim())
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*+]\s+/gm, '')
    .replace(/^\s{0,3}\d+\.\s+/gm, '')
    .replace(/^-{3,}$/gm, '')
    .trim();
}

export class MarkdownParser extends BaseDocumentParser {
  readonly format = 'markdown' as const;

  protected rawParse(input: RawDocumentInput): ParsedDocument {
    const lines = input.content.replace(/\r\n/g, '\n').split('\n');
    const headers: RawHeaderLine[] = [];

    lines.forEach((line, i) => {
      const match = /^(#{1,6})\s+(.*)$/.exec(line);
      if (match) headers.push({ level: match[1].length, title: match[2].trim(), lineIndex: i });
    });

    const sections: MarkdownSection[] = [];

    if (headers.length === 0) {
      sections.push({ headerPath: [], headingLevel: 0, content: normalizeWhitespace(stripMarkdownSyntax(input.content)) });
    } else {
      if (headers[0].lineIndex > 0) {
        const intro = lines.slice(0, headers[0].lineIndex).join('\n');
        if (intro.trim()) {
          sections.push({ headerPath: [], headingLevel: 0, content: normalizeWhitespace(stripMarkdownSyntax(intro)) });
        }
      }

      const pathStack: { level: number; title: string }[] = [];
      headers.forEach((header, idx) => {
        while (pathStack.length && pathStack[pathStack.length - 1].level >= header.level) {
          pathStack.pop();
        }
        pathStack.push({ level: header.level, title: header.title });

        const nextLineIndex = idx + 1 < headers.length ? headers[idx + 1].lineIndex : lines.length;
        const bodyLines = lines.slice(header.lineIndex + 1, nextLineIndex);
        const content = normalizeWhitespace(stripMarkdownSyntax(bodyLines.join('\n')));

        sections.push({
          headerPath: pathStack.map((p) => p.title),
          headingLevel: header.level,
          content,
        });
      });
    }

    const nonEmptySections = sections.filter((s) => s.content.trim().length > 0);

    const text = normalizeWhitespace(
      nonEmptySections.map((s) => (s.headerPath.length ? `${s.headerPath.join(' > ')}\n${s.content}` : s.content)).join('\n\n'),
    );

    return { text, structure: { markdownSections: nonEmptySections } };
  }
}

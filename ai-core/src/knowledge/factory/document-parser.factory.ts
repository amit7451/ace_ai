import { DocumentFormat } from '../types/knowledge-config.types';
import { IDocumentParser } from '../interfaces/document-parser.interface';
import { PlainTextParser } from '../parsers/plain-text/plain-text.parser';
import { MarkdownParser } from '../parsers/markdown/markdown.parser';
import { HtmlParser } from '../parsers/html/html.parser';
import { CsvParser } from '../parsers/csv/csv.parser';
import { KnowledgeUnsupportedFormatError } from '../errors/knowledge.errors';

/**
 * The only place that knows about concrete parser classes. Everything else
 * depends on `IDocumentParser`. Mirrors `LLMProviderFactory` /
 * `EmbeddingProviderFactory` / `VectorStoreProviderFactory` from Components
 * 1-3 — adding a format is "extend the union, add a schema enum entry,
 * add a case here", never a change to any caller.
 */
export class DocumentParserFactory {
  static create(format: DocumentFormat): IDocumentParser {
    switch (format) {
      case 'plain-text':
        return new PlainTextParser();
      case 'markdown':
        return new MarkdownParser();
      case 'html':
        return new HtmlParser();
      case 'csv':
        return new CsvParser();
      default: {
        const exhaustiveCheck: never = format;
        throw new KnowledgeUnsupportedFormatError(String(exhaustiveCheck));
      }
    }
  }
}

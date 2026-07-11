import { DocumentParserFactory } from '../../../src/knowledge/factory/document-parser.factory';
import { PlainTextParser } from '../../../src/knowledge/parsers/plain-text/plain-text.parser';
import { MarkdownParser } from '../../../src/knowledge/parsers/markdown/markdown.parser';
import { HtmlParser } from '../../../src/knowledge/parsers/html/html.parser';
import { CsvParser } from '../../../src/knowledge/parsers/csv/csv.parser';

describe('DocumentParserFactory', () => {
  it('creates a PlainTextParser', () => {
    expect(DocumentParserFactory.create('plain-text')).toBeInstanceOf(PlainTextParser);
  });

  it('creates a MarkdownParser', () => {
    expect(DocumentParserFactory.create('markdown')).toBeInstanceOf(MarkdownParser);
  });

  it('creates an HtmlParser', () => {
    expect(DocumentParserFactory.create('html')).toBeInstanceOf(HtmlParser);
  });

  it('creates a CsvParser', () => {
    expect(DocumentParserFactory.create('csv')).toBeInstanceOf(CsvParser);
  });

  it('throws for an unsupported format', () => {
    expect(() => DocumentParserFactory.create('pdf' as never)).toThrow();
  });
});

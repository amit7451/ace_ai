export * from './interfaces/parser.interface';
export * from './parsers/pdf.parser';
export * from './parsers/docx.parser';
export * from './parsers/txt.parser';
export * from './parsers/markdown.parser';
export * from './parsers/html.parser';

import { IParser } from './interfaces/parser.interface';
import { PdfParser } from './parsers/pdf.parser';
import { DocxParser } from './parsers/docx.parser';
import { TxtParser } from './parsers/txt.parser';
import { MarkdownParser } from './parsers/markdown.parser';
import { HtmlParser } from './parsers/html.parser';

export class ParserFactory {
  static getParser(mimeType: string): IParser {
    switch (mimeType) {
      case 'application/pdf':
        return new PdfParser();
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return new DocxParser();
      case 'text/plain':
        return new TxtParser();
      case 'text/markdown':
      case 'text/md':
        return new MarkdownParser();
      case 'text/html':
        return new HtmlParser();
      default:
        throw new Error(`Unsupported MIME type: ${mimeType}`);
    }
  }
}

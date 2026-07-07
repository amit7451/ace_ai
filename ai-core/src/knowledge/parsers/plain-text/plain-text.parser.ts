import { RawDocumentInput, ParsedDocument } from '../../types/knowledge-document.types';
import { BaseDocumentParser } from '../base/base-document-parser';
import { normalizeWhitespace } from '../../utils/text-cleaning';

export class PlainTextParser extends BaseDocumentParser {
  readonly format = 'plain-text' as const;

  protected rawParse(input: RawDocumentInput): ParsedDocument {
    return { text: normalizeWhitespace(input.content) };
  }
}

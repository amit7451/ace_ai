import { DocumentFormat } from '../../types/knowledge-config.types';
import { RawDocumentInput, ParsedDocument } from '../../types/knowledge-document.types';
import { IDocumentParser } from '../../interfaces/document-parser.interface';
import { KnowledgeEmptyContentError } from '../../errors/knowledge.errors';

/**
 * Shared input validation for every format parser — mirrors the
 * `BaseLLMProvider`/`BaseEmbeddingProvider`/`BaseVectorStoreProvider`
 * "raw*" pattern from Components 1-3: concrete parsers only implement
 * `rawParse`, format-specific extraction logic guaranteed to receive
 * non-empty input.
 */
export abstract class BaseDocumentParser implements IDocumentParser {
  abstract readonly format: DocumentFormat;

  parse(input: RawDocumentInput): ParsedDocument {
    if (!input.content || input.content.trim().length === 0) {
      throw new KnowledgeEmptyContentError(this.format);
    }
    return this.rawParse(input);
  }

  protected abstract rawParse(input: RawDocumentInput): ParsedDocument;
}

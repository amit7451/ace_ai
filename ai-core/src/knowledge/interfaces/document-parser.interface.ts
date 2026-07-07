import { DocumentFormat } from '../types/knowledge-config.types';
import { RawDocumentInput, ParsedDocument } from '../types/knowledge-document.types';

/**
 * The contract every format parser implements. `DocumentParserFactory` is
 * the only place that knows about concrete parser classes — application
 * code (the `KnowledgeProcessor`, and eventually Components 4/5 callers in
 * apps/worker) depends only on this interface.
 */
export interface IDocumentParser {
  readonly format: DocumentFormat;
  parse(input: RawDocumentInput): ParsedDocument;
}

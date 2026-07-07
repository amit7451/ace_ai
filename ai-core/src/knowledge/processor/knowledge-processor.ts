import { DocumentFormat, ChunkingStrategyName, KnowledgeSourceType, ChunkingOptions, KnowledgeProcessingConfig } from '../types/knowledge-config.types';
import { RawDocumentInput } from '../types/knowledge-document.types';
import { KnowledgeChunk } from '../types/knowledge-chunk.types';
import { DocumentParserFactory } from '../factory/document-parser.factory';
import { ChunkingStrategyFactory } from '../factory/chunking-strategy.factory';
import { knowledgeProcessingConfigSchema, chunkingOptionsSchema } from '../schemas/knowledge-config.schema';
import { deterministicUuidV5 } from '../utils/id-generation';
import { estimateTokens } from '../utils/token-estimation';
import { KnowledgeEmptyContentError } from '../errors/knowledge.errors';

const DEFAULT_STRATEGY_BY_FORMAT: Record<DocumentFormat, ChunkingStrategyName> = {
  'plain-text': 'recursive',
  markdown: 'markdown-aware',
  html: 'recursive',
  csv: 'csv-row',
};

const DEFAULT_SOURCE_TYPE_BY_FORMAT: Record<DocumentFormat, KnowledgeSourceType> = {
  'plain-text': 'document',
  markdown: 'document',
  html: 'website',
  csv: 'faq',
};

const DEFAULT_CHUNKING_BY_FORMAT: Record<DocumentFormat, ChunkingOptions> = {
  'plain-text': { maxChunkSize: 1000, chunkOverlap: 150 },
  markdown: { maxChunkSize: 1000, chunkOverlap: 150 },
  html: { maxChunkSize: 1000, chunkOverlap: 150 },
  csv: { maxChunkSize: 1000, chunkOverlap: 0, rowsPerChunk: 1 },
};

/** Infers a `DocumentFormat` from mimeType first, then file extension, defaulting to plain-text. */
export function inferFormat(input: RawDocumentInput): DocumentFormat {
  const mime = input.mimeType?.toLowerCase();
  if (mime === 'text/markdown') return 'markdown';
  if (mime === 'text/html') return 'html';
  if (mime === 'text/csv') return 'csv';

  const ext = input.fileName?.split('.').pop()?.toLowerCase();
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'csv') return 'csv';

  return 'plain-text';
}

/** Merges a partial override over a format's defaults, then validates the *resolved* whole (including the overlap-vs-maxChunkSize cross-field check). */
export function resolveChunkingOptions(format: DocumentFormat, overrides?: Partial<ChunkingOptions>): ChunkingOptions {
  const merged = { ...DEFAULT_CHUNKING_BY_FORMAT[format], ...overrides };
  return chunkingOptionsSchema.parse(merged);
}

/**
 * Maps a `KnowledgeChunk` onto the exact payload shape Component 3's
 * README shows for `store.upsertBatch(...)`: tenantId, assistantId,
 * documentId, chunkId, chunkIndex, text, sourceType, createdAt — plus an
 * optional nested `metadata` bag when a chunking strategy attached one, so
 * there's no risk of a strategy's metadata key colliding with a core field.
 */
export function toKnowledgeVectorPayload(chunk: KnowledgeChunk): Record<string, unknown> {
  const { metadata, ...core } = chunk;
  return metadata ? { ...core, metadata } : { ...core };
}

/**
 * The high-level façade most callers use: parse -> chunk -> attach
 * tenant/document/id metadata, in one call. Depends only on
 * `DocumentParserFactory` and `ChunkingStrategyFactory` — never on a
 * concrete parser or strategy class — so it needs no changes when a new
 * format or strategy is added to either factory.
 */
export class KnowledgeProcessor {
  process(input: RawDocumentInput, rawConfig: KnowledgeProcessingConfig): KnowledgeChunk[] {
    const config = knowledgeProcessingConfigSchema.parse(rawConfig);

    const format = config.format ?? inferFormat(input);
    const parser = DocumentParserFactory.create(format);
    const parsed = parser.parse(input);

    const strategyName = config.strategy ?? DEFAULT_STRATEGY_BY_FORMAT[format];
    const strategy = ChunkingStrategyFactory.create(strategyName);
    const chunkingOptions = resolveChunkingOptions(format, config.chunking);

    const chunkedTexts = strategy.chunk(parsed, chunkingOptions);
    if (chunkedTexts.length === 0) {
      throw new KnowledgeEmptyContentError(format);
    }

    const sourceType = config.sourceType ?? DEFAULT_SOURCE_TYPE_BY_FORMAT[format];
    const createdAt = new Date().toISOString();

    return chunkedTexts.map((chunked, index) => ({
      chunkId: deterministicUuidV5(`${config.documentId}:${index}`),
      documentId: config.documentId,
      tenantId: config.tenantId,
      assistantId: config.assistantId,
      chunkIndex: index,
      text: chunked.text,
      sourceType,
      createdAt,
      tokenCount: estimateTokens(chunked.text),
      metadata: chunked.metadata,
    }));
  }
}

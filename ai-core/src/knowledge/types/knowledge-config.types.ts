/**
 * Formats this component can parse directly. Deliberately smaller than the
 * architecture doc's full Phase 3 list (which also names PDF and DOCX
 * parsers) — see the README "Why these four formats" for the reasoning.
 * Binary formats are expected to already be extracted to plain text
 * upstream (e.g. in apps/worker via pdf-parse/mammoth) before reaching this
 * layer; extending this union is the same "add a variant, add a schema
 * enum entry, add a factory case" exercise Components 1-3 already document.
 */
export type DocumentFormat = 'plain-text' | 'markdown' | 'html' | 'csv';

/**
 * Every chunking strategy this component ships. `recursive` is the
 * general-purpose default; `markdown-aware` and `csv-row` exploit
 * structural hints a format-specific parser can provide.
 */
export type ChunkingStrategyName = 'fixed-size' | 'recursive' | 'markdown-aware' | 'csv-row';

/**
 * Mirrors the knowledge sources named in the product vision doc:
 * "documents, websites, FAQs, policies, manuals, and other approved
 * sources." Stored directly on `KnowledgeVectorPayload.sourceType`
 * (Component 3) so the RAG Retriever (Component 5) and dashboard can filter
 * or display results by source category.
 */
export type KnowledgeSourceType = 'document' | 'website' | 'faq' | 'policy' | 'manual' | 'other';

export interface ChunkingOptions {
  /** Soft upper bound on chunk length, in characters (not tokens — see README on why characters, not tokens). */
  maxChunkSize: number;
  /** How many trailing characters of the previous chunk are repeated at the start of the next, for retrieval continuity across a chunk boundary. */
  chunkOverlap: number;
  /** csv-row strategy only: how many CSV data rows form one chunk. Default 1 (one self-contained row per chunk — ideal for FAQ-style CSVs). */
  rowsPerChunk?: number;
}

export interface KnowledgeProcessingConfig {
  /** If omitted, inferred from the input's mimeType/fileName (see `inferFormat`). */
  format?: DocumentFormat;
  /** If omitted, a sensible default is chosen per format (markdown-aware for markdown, csv-row for csv, recursive otherwise). */
  strategy?: ChunkingStrategyName;
  /** Merged over per-format defaults, then validated as a whole (see `resolveChunkingOptions`). */
  chunking?: Partial<ChunkingOptions>;
  /** If omitted, a sensible default is chosen per format (see `DEFAULT_SOURCE_TYPE_BY_FORMAT`). */
  sourceType?: KnowledgeSourceType;
  tenantId: string;
  assistantId: string;
  documentId: string;
}

import { KnowledgeSourceType } from './knowledge-config.types';

/** What a chunking strategy produces — before document/tenant/id metadata is attached by the processor. */
export interface ChunkedText {
  text: string;
  /** Strategy-specific extras: e.g. `{ headerPath: [...] }` from markdown-aware, `{ rowRange: [...] }` from csv-row. */
  metadata?: Record<string, unknown>;
}

/**
 * The final output of this component. Field names deliberately match
 * Component 3's `KnowledgeVectorPayload` usage example one-for-one
 * (tenantId, assistantId, documentId, chunkId, chunkIndex, text, sourceType,
 * createdAt) — see `toKnowledgeVectorPayload()` for the direct mapping.
 */
export interface KnowledgeChunk {
  /** Deterministic UUIDv5 derived from `${documentId}:${chunkIndex}` — see utils/id-generation.ts. */
  chunkId: string;
  documentId: string;
  tenantId: string;
  assistantId: string;
  chunkIndex: number;
  text: string;
  sourceType: KnowledgeSourceType;
  /** ISO-8601 timestamp, set once per `process()` call (identical across all chunks from the same call). */
  createdAt: string;
  /** Estimated via the same chars/4 heuristic as Components 1 and 2 — useful for pre-flight embedBatch sizing, not for billing. */
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

export type VectorId = string | number;

/**
 * Recommended (not enforced) payload shape for this platform's knowledge
 * vectors. This is what Knowledge Chunking (Component 4) is expected to
 * attach to every chunk it embeds, and what RAG Retriever (Component 5)
 * will read back out.
 *
 * `IVectorStore` itself is generic over the payload type — nothing in this
 * layer requires this exact shape — but standardizing on it now means
 * Components 4 and 5 don't each invent their own metadata schema, and
 * every query can safely filter on `tenantId`/`assistantId` for
 * multi-tenant isolation (Principle 2).
 */
export interface KnowledgeVectorPayload {
  tenantId: string;
  assistantId: string;
  documentId: string;
  chunkId: string;
  chunkIndex: number;
  text: string;
  sourceType: 'document' | 'website' | 'faq' | 'manual';
  sourceUrl?: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  [key: string]: unknown;
}

export interface VectorRecord<TPayload = KnowledgeVectorPayload> {
  id: VectorId;
  vector: number[];
  payload?: TPayload;
}

export interface UpsertResult {
  upsertedCount: number;
  ids: VectorId[];
}

export interface DeleteResult {
  deletedCount: number;
}

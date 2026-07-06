import { VectorStoreProviderName } from '../types/vector-store-config.types';
import { CreateCollectionConfig, CollectionInfo } from '../types/collection.types';
import {
  DeleteResult,
  KnowledgeVectorPayload,
  UpsertResult,
  VectorId,
  VectorRecord,
} from '../types/vector-record.types';
import { VectorFilter, VectorSearchQuery, VectorSearchResult } from '../types/search.types';

/**
 * The single contract every vector store vendor implements. Knowledge
 * Chunking (Component 4) and RAG Retriever (Component 5) depend only on
 * this interface, never on `QdrantVectorStoreProvider` directly — same
 * "Provider Agnostic" rule as `ILlmProvider` (Component 1) and
 * `IEmbeddingProvider` (Component 2).
 */
export interface IVectorStore {
  readonly provider: VectorStoreProviderName;

  /** Creates a new collection. Throws `VectorStoreAlreadyExistsError`-style errors if it already exists (unless `recreateIfExists` is set). */
  createCollection(config: CreateCollectionConfig): Promise<CollectionInfo>;

  /**
   * Idempotent alternative to `createCollection`: returns the existing
   * collection if it already matches `vectorSize`, creates it if missing,
   * and throws if it exists with a *different* vector size (a strong
   * signal of an embedding-model mismatch, not something to silently
   * paper over).
   */
  getOrCreateCollection(config: CreateCollectionConfig): Promise<CollectionInfo>;

  deleteCollection(name: string): Promise<void>;
  collectionExists(name: string): Promise<boolean>;
  getCollectionInfo(name: string): Promise<CollectionInfo>;

  /** Convenience wrapper over `upsertBatch` for a single record. */
  upsert<TPayload = KnowledgeVectorPayload>(
    collection: string,
    record: VectorRecord<TPayload>
  ): Promise<UpsertResult>;

  /**
   * The base primitive. Automatically chunked into vendor-safe request
   * sizes and reassembled — same batching-first shape as Component 2's
   * `embedBatch()`.
   */
  upsertBatch<TPayload = KnowledgeVectorPayload>(
    collection: string,
    records: VectorRecord<TPayload>[]
  ): Promise<UpsertResult>;

  search<TPayload = KnowledgeVectorPayload>(
    collection: string,
    query: VectorSearchQuery
  ): Promise<VectorSearchResult<TPayload>[]>;

  getById<TPayload = KnowledgeVectorPayload>(
    collection: string,
    ids: VectorId[]
  ): Promise<VectorRecord<TPayload>[]>;

  delete(collection: string, ids: VectorId[]): Promise<DeleteResult>;

  /** Deletes every point matching `filter` — used for reindexing (drop all chunks for a document/source before re-embedding). */
  deleteByFilter(collection: string, filter: VectorFilter): Promise<DeleteResult>;

  count(collection: string, filter?: VectorFilter): Promise<number>;

  /** Never throws — returns `false` on any connectivity or server error. */
  healthCheck(): Promise<boolean>;
}

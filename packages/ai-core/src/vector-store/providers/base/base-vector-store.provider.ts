import { IVectorStore } from '../../interfaces/vector-store.interface';
import { VectorStoreConfig, VectorStoreProviderName } from '../../types/vector-store-config.types';
import { CollectionInfo, CreateCollectionConfig } from '../../types/collection.types';
import {
  DeleteResult,
  KnowledgeVectorPayload,
  UpsertResult,
  VectorId,
  VectorRecord,
} from '../../types/vector-record.types';
import { VectorFilter, VectorSearchQuery, VectorSearchResult } from '../../types/search.types';
import {
  VectorStoreAlreadyExistsError,
  VectorStoreTimeoutError,
} from '../../errors/vector-store.errors';
import { retryWithBackoff, withTimeout } from '../../utils/retry';
import { chunkArray } from '../../utils/batching';
import { validateVectorDimension } from '../../utils/validate-dimension';

/**
 * Cross-cutting concerns shared by every vector store vendor: retry with
 * backoff, per-attempt timeouts, automatic upsert batching, and dimension
 * validation. Concrete providers (see `providers/qdrant/`) only implement
 * the vendor-specific `raw*` primitives — the "batching-first" and
 * "resilience by default" principles live here exactly once.
 *
 * This is the vector-store-layer equivalent of Component 2's
 * `BaseEmbeddingProvider`.
 */
export abstract class BaseVectorStoreProvider implements IVectorStore {
  abstract readonly provider: VectorStoreProviderName;

  /** Vendor's own safe batch size, e.g. Qdrant's default of 200. Overridden per-instance via `config.maxBatchSize`. */
  protected abstract vendorMaxBatchSize: number;

  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly configuredMaxBatchSize?: number;

  /**
   * Collection name -> vector size. Populated on create/info calls so
   * `upsert`/`search` can validate dimensions without a network round
   * trip on every call — only on the first call for a given collection
   * in this provider instance's lifetime.
   */
  private readonly dimensionCache = new Map<string, number>();

  protected constructor(config: VectorStoreConfig) {
    this.timeoutMs = config.timeout ?? 10_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.configuredMaxBatchSize = config.maxBatchSize;
  }

  private get effectiveMaxBatchSize(): number {
    return this.configuredMaxBatchSize ?? this.vendorMaxBatchSize;
  }

  private async execute<T>(fn: () => Promise<T>, timeoutMessage: string): Promise<T> {
    return retryWithBackoff(
      () =>
        withTimeout(
          fn(),
          this.timeoutMs,
          () => new VectorStoreTimeoutError(timeoutMessage, { provider: this.provider })
        ),
      { maxRetries: this.maxRetries }
    );
  }

  async createCollection(config: CreateCollectionConfig): Promise<CollectionInfo> {
    const info = await this.execute(
      () => this.rawCreateCollection(config),
      `Timed out creating collection "${config.name}"`
    );
    this.dimensionCache.set(info.name, info.vectorSize);
    return info;
  }

  async getOrCreateCollection(config: CreateCollectionConfig): Promise<CollectionInfo> {
    const exists = await this.collectionExists(config.name);
    if (!exists) {
      return this.createCollection(config);
    }

    const info = await this.getCollectionInfo(config.name);
    if (info.vectorSize !== config.vectorSize) {
      throw new VectorStoreAlreadyExistsError(
        `Collection "${config.name}" already exists with vector size ${info.vectorSize}, but ${config.vectorSize} was requested. ` +
          "Delete the collection first if you're intentionally migrating to a new embedding model, or double check you're targeting the right collection.",
        { provider: this.provider }
      );
    }
    return info;
  }

  async deleteCollection(name: string): Promise<void> {
    await this.execute(
      () => this.rawDeleteCollection(name),
      `Timed out deleting collection "${name}"`
    );
    this.dimensionCache.delete(name);
  }

  async collectionExists(name: string): Promise<boolean> {
    return this.execute(
      () => this.rawCollectionExists(name),
      `Timed out checking collection "${name}"`
    );
  }

  async getCollectionInfo(name: string): Promise<CollectionInfo> {
    const info = await this.execute(
      () => this.rawGetCollectionInfo(name),
      `Timed out fetching collection "${name}"`
    );
    this.dimensionCache.set(info.name, info.vectorSize);
    return info;
  }

  async upsert<TPayload = KnowledgeVectorPayload>(
    collection: string,
    record: VectorRecord<TPayload>
  ): Promise<UpsertResult> {
    return this.upsertBatch(collection, [record]);
  }

  async upsertBatch<TPayload = KnowledgeVectorPayload>(
    collection: string,
    records: VectorRecord<TPayload>[]
  ): Promise<UpsertResult> {
    if (records.length === 0) {
      return { upsertedCount: 0, ids: [] };
    }

    const expectedSize = await this.resolveDimension(collection);
    for (const record of records) {
      validateVectorDimension(
        record.vector,
        expectedSize,
        this.provider,
        `upsert into "${collection}"`
      );
    }

    const batches = chunkArray(records, this.effectiveMaxBatchSize);
    let upsertedCount = 0;
    const ids: VectorId[] = [];

    for (const batch of batches) {
      const result = await this.execute(
        () => this.rawUpsertBatch(collection, batch),
        `Timed out upserting ${batch.length} vector(s) into "${collection}"`
      );
      upsertedCount += result.upsertedCount;
      ids.push(...result.ids);
    }

    return { upsertedCount, ids };
  }

  async search<TPayload = KnowledgeVectorPayload>(
    collection: string,
    query: VectorSearchQuery
  ): Promise<VectorSearchResult<TPayload>[]> {
    const expectedSize = await this.resolveDimension(collection);
    validateVectorDimension(query.vector, expectedSize, this.provider, `search on "${collection}"`);

    const normalized: VectorSearchQuery = {
      topK: 5,
      withPayload: true,
      withVector: false,
      ...query,
    };

    return this.execute(
      () => this.rawSearch<TPayload>(collection, normalized),
      `Timed out searching "${collection}"`
    );
  }

  async getById<TPayload = KnowledgeVectorPayload>(
    collection: string,
    ids: VectorId[]
  ): Promise<VectorRecord<TPayload>[]> {
    if (ids.length === 0) return [];
    return this.execute(
      () => this.rawGetById<TPayload>(collection, ids),
      `Timed out fetching ${ids.length} point(s) from "${collection}"`
    );
  }

  async delete(collection: string, ids: VectorId[]): Promise<DeleteResult> {
    if (ids.length === 0) return { deletedCount: 0 };
    return this.execute(
      () => this.rawDelete(collection, ids),
      `Timed out deleting ${ids.length} point(s) from "${collection}"`
    );
  }

  async deleteByFilter(collection: string, filter: VectorFilter): Promise<DeleteResult> {
    return this.execute(
      () => this.rawDeleteByFilter(collection, filter),
      `Timed out deleting by filter from "${collection}"`
    );
  }

  async count(collection: string, filter?: VectorFilter): Promise<number> {
    return this.execute(
      () => this.rawCount(collection, filter),
      `Timed out counting points in "${collection}"`
    );
  }

  async healthCheck(): Promise<boolean> {
    try {
      return await withTimeout(
        this.rawHealthCheck(),
        this.timeoutMs,
        () => new VectorStoreTimeoutError('Timed out on health check', { provider: this.provider })
      );
    } catch {
      return false;
    }
  }

  private async resolveDimension(collection: string): Promise<number> {
    const cached = this.dimensionCache.get(collection);
    if (cached !== undefined) return cached;
    const info = await this.getCollectionInfo(collection); // also populates the cache
    return info.vectorSize;
  }

  protected abstract rawCreateCollection(config: CreateCollectionConfig): Promise<CollectionInfo>;
  protected abstract rawGetCollectionInfo(name: string): Promise<CollectionInfo>;
  protected abstract rawDeleteCollection(name: string): Promise<void>;
  protected abstract rawCollectionExists(name: string): Promise<boolean>;
  protected abstract rawUpsertBatch<TPayload>(
    collection: string,
    records: VectorRecord<TPayload>[]
  ): Promise<UpsertResult>;
  protected abstract rawSearch<TPayload>(
    collection: string,
    query: VectorSearchQuery
  ): Promise<VectorSearchResult<TPayload>[]>;
  protected abstract rawGetById<TPayload>(
    collection: string,
    ids: VectorId[]
  ): Promise<VectorRecord<TPayload>[]>;
  protected abstract rawDelete(collection: string, ids: VectorId[]): Promise<DeleteResult>;
  protected abstract rawDeleteByFilter(
    collection: string,
    filter: VectorFilter
  ): Promise<DeleteResult>;
  protected abstract rawCount(collection: string, filter?: VectorFilter): Promise<number>;
  protected abstract rawHealthCheck(): Promise<boolean>;
}

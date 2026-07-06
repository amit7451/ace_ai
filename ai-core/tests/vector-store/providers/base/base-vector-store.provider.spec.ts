import { BaseVectorStoreProvider } from '../../../../src/vector-store/providers/base/base-vector-store.provider';
import { VectorStoreConfig, VectorStoreProviderName } from '../../../../src/vector-store/types/vector-store-config.types';
import { CollectionInfo, CreateCollectionConfig } from '../../../../src/vector-store/types/collection.types';
import { DeleteResult, UpsertResult, VectorId, VectorRecord } from '../../../../src/vector-store/types/vector-record.types';
import { VectorFilter, VectorSearchQuery, VectorSearchResult } from '../../../../src/vector-store/types/search.types';
import {
  VectorStoreAlreadyExistsError,
  VectorStoreDimensionMismatchError,
} from '../../../../src/vector-store/errors/vector-store.errors';

/**
 * A hand-written fake rather than `jest.fn()` mocks: overriding a generic
 * abstract *method* with a mocked *property* is fragile across
 * TypeScript/`@types/jest` versions, so this fake tracks calls in plain
 * arrays instead. It's a real subclass exercising the real base-class
 * logic (batching, dimension caching, retry wiring) — only the network
 * boundary is faked.
 */
class TestVectorStoreProvider extends BaseVectorStoreProvider {
  readonly provider: VectorStoreProviderName = 'qdrant';
  protected vendorMaxBatchSize = 2;

  readonly calls = {
    createCollection: [] as CreateCollectionConfig[],
    getCollectionInfo: [] as string[],
    deleteCollection: [] as string[],
    collectionExists: [] as string[],
    upsertBatch: [] as { collection: string; records: VectorRecord<unknown>[] }[],
    search: [] as { collection: string; query: VectorSearchQuery }[],
    getById: [] as { collection: string; ids: VectorId[] }[],
    delete: [] as { collection: string; ids: VectorId[] }[],
    deleteByFilter: [] as { collection: string; filter: VectorFilter }[],
    count: [] as { collection: string; filter?: VectorFilter }[],
    healthCheck: 0,
  };

  collectionInfoToReturn: CollectionInfo = {
    name: 'default',
    vectorSize: 4,
    distance: 'cosine',
    pointsCount: 0,
    status: 'green',
  };
  existsToReturn = true;
  healthCheckResult: boolean | 'throw' = true;

  constructor(config: VectorStoreConfig) {
    super(config);
  }

  protected async rawCreateCollection(config: CreateCollectionConfig): Promise<CollectionInfo> {
    this.calls.createCollection.push(config);
    return {
      name: config.name,
      vectorSize: config.vectorSize,
      distance: config.distance ?? 'cosine',
      pointsCount: 0,
      status: 'green',
    };
  }

  protected async rawGetCollectionInfo(name: string): Promise<CollectionInfo> {
    this.calls.getCollectionInfo.push(name);
    return { ...this.collectionInfoToReturn, name };
  }

  protected async rawDeleteCollection(name: string): Promise<void> {
    this.calls.deleteCollection.push(name);
  }

  protected async rawCollectionExists(name: string): Promise<boolean> {
    this.calls.collectionExists.push(name);
    return this.existsToReturn;
  }

  protected async rawUpsertBatch<TPayload>(
    collection: string,
    records: VectorRecord<TPayload>[]
  ): Promise<UpsertResult> {
    this.calls.upsertBatch.push({ collection, records: records as VectorRecord<unknown>[] });
    return { upsertedCount: records.length, ids: records.map((r) => r.id) };
  }

  protected async rawSearch<TPayload>(
    collection: string,
    query: VectorSearchQuery
  ): Promise<VectorSearchResult<TPayload>[]> {
    this.calls.search.push({ collection, query });
    return [];
  }

  protected async rawGetById<TPayload>(collection: string, ids: VectorId[]): Promise<VectorRecord<TPayload>[]> {
    this.calls.getById.push({ collection, ids });
    return [];
  }

  protected async rawDelete(collection: string, ids: VectorId[]): Promise<DeleteResult> {
    this.calls.delete.push({ collection, ids });
    return { deletedCount: ids.length };
  }

  protected async rawDeleteByFilter(collection: string, filter: VectorFilter): Promise<DeleteResult> {
    this.calls.deleteByFilter.push({ collection, filter });
    return { deletedCount: 0 };
  }

  protected async rawCount(collection: string, filter?: VectorFilter): Promise<number> {
    this.calls.count.push({ collection, filter });
    return 0;
  }

  protected async rawHealthCheck(): Promise<boolean> {
    this.calls.healthCheck += 1;
    if (this.healthCheckResult === 'throw') {
      throw new Error('health check failed');
    }
    return this.healthCheckResult;
  }
}

function makeProvider(overrides: Partial<VectorStoreConfig> = {}): TestVectorStoreProvider {
  return new TestVectorStoreProvider({ provider: 'qdrant', url: 'http://localhost:6333', maxRetries: 0, ...overrides });
}

describe('BaseVectorStoreProvider', () => {
  it('upsert() delegates to upsertBatch() with a single-item array', async () => {
    const provider = makeProvider();
    const result = await provider.upsert('docs', { id: 1, vector: [0, 0, 0, 0] });
    expect(result).toEqual({ upsertedCount: 1, ids: [1] });
    expect(provider.calls.upsertBatch).toHaveLength(1);
    expect(provider.calls.upsertBatch[0].records).toHaveLength(1);
  });

  it('upsertBatch() chunks records according to vendorMaxBatchSize and reassembles results in order', async () => {
    const provider = makeProvider(); // vendorMaxBatchSize = 2
    const records = [1, 2, 3, 4, 5].map((id) => ({ id, vector: [0, 0, 0, 0] }));

    const result = await provider.upsertBatch('docs', records);

    expect(result).toEqual({ upsertedCount: 5, ids: [1, 2, 3, 4, 5] });
    expect(provider.calls.upsertBatch).toHaveLength(3); // 2 + 2 + 1
    expect(provider.calls.upsertBatch.map((c) => c.records.length)).toEqual([2, 2, 1]);
  });

  it('respects a maxBatchSize override from config over the vendor default', async () => {
    const provider = makeProvider({ maxBatchSize: 1 });
    const records = [1, 2, 3].map((id) => ({ id, vector: [0, 0, 0, 0] }));

    await provider.upsertBatch('docs', records);

    expect(provider.calls.upsertBatch).toHaveLength(3);
  });

  it('upsertBatch() short-circuits on an empty array without any raw call', async () => {
    const provider = makeProvider();
    const result = await provider.upsertBatch('docs', []);
    expect(result).toEqual({ upsertedCount: 0, ids: [] });
    expect(provider.calls.upsertBatch).toHaveLength(0);
    expect(provider.calls.getCollectionInfo).toHaveLength(0); // never even looked up the dimension
  });

  it('caches the collection dimension after the first lookup', async () => {
    const provider = makeProvider();
    await provider.upsertBatch('docs', [{ id: 1, vector: [0, 0, 0, 0] }]);
    await provider.upsertBatch('docs', [{ id: 2, vector: [0, 0, 0, 0] }]);
    expect(provider.calls.getCollectionInfo).toHaveLength(1); // only looked up once
  });

  it('throws a dimension mismatch before making any raw upsert call', async () => {
    const provider = makeProvider();
    await expect(provider.upsertBatch('docs', [{ id: 1, vector: [0, 0] }])).rejects.toBeInstanceOf(
      VectorStoreDimensionMismatchError
    );
    expect(provider.calls.upsertBatch).toHaveLength(0);
  });

  it('delete() and getById() short-circuit on an empty id list', async () => {
    const provider = makeProvider();
    expect(await provider.delete('docs', [])).toEqual({ deletedCount: 0 });
    expect(await provider.getById('docs', [])).toEqual([]);
    expect(provider.calls.delete).toHaveLength(0);
    expect(provider.calls.getById).toHaveLength(0);
  });

  describe('getOrCreateCollection', () => {
    it('creates the collection when it does not exist', async () => {
      const provider = makeProvider();
      provider.existsToReturn = false;
      const info = await provider.getOrCreateCollection({ name: 'new_col', vectorSize: 8 });
      expect(info.vectorSize).toBe(8);
      expect(provider.calls.createCollection).toHaveLength(1);
    });

    it('returns the existing collection when the vector size matches', async () => {
      const provider = makeProvider();
      provider.existsToReturn = true;
      provider.collectionInfoToReturn = { name: 'x', vectorSize: 4, distance: 'cosine', pointsCount: 10, status: 'green' };
      const info = await provider.getOrCreateCollection({ name: 'x', vectorSize: 4 });
      expect(info.pointsCount).toBe(10);
      expect(provider.calls.createCollection).toHaveLength(0);
    });

    it('throws when the existing collection has a different vector size', async () => {
      const provider = makeProvider();
      provider.existsToReturn = true;
      provider.collectionInfoToReturn = { name: 'x', vectorSize: 4, distance: 'cosine', pointsCount: 10, status: 'green' };
      await expect(provider.getOrCreateCollection({ name: 'x', vectorSize: 1536 })).rejects.toBeInstanceOf(
        VectorStoreAlreadyExistsError
      );
    });
  });

  describe('healthCheck', () => {
    it('returns true when the raw health check succeeds', async () => {
      const provider = makeProvider();
      provider.healthCheckResult = true;
      expect(await provider.healthCheck()).toBe(true);
    });

    it('returns false, and never throws, when the raw health check fails', async () => {
      const provider = makeProvider();
      provider.healthCheckResult = 'throw';
      expect(await provider.healthCheck()).toBe(false);
    });
  });
});

import { QdrantVectorStoreProvider } from '../../../../src/vector-store/providers/qdrant/qdrant-vector-store.provider';
import {
  VectorStoreAuthenticationError,
  VectorStoreConnectionError,
  VectorStoreDimensionMismatchError,
} from '../../../../src/vector-store/errors/vector-store.errors';

function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const COLLECTION_INFO_BODY = {
  result: {
    status: 'green',
    points_count: 42,
    config: { params: { vectors: { size: 4, distance: 'Cosine' } } },
  },
};

describe('QdrantVectorStoreProvider', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  function createProvider(overrides: Partial<{ maxRetries: number; timeout: number }> = {}) {
    return new QdrantVectorStoreProvider({
      provider: 'qdrant',
      url: 'http://localhost:6333',
      maxRetries: overrides.maxRetries ?? 0,
      timeout: overrides.timeout ?? 5000,
    });
  }

  describe('createCollection', () => {
    it('sends a PUT to create the collection, then fetches its info', async () => {
      fetchMock
        .mockResolvedValueOnce(fakeResponse(200, { result: { status: 'ok' } })) // PUT create
        .mockResolvedValueOnce(fakeResponse(200, COLLECTION_INFO_BODY)); // GET info

      const provider = createProvider();
      const info = await provider.createCollection({ name: 'docs', vectorSize: 4 });

      expect(info).toEqual({
        name: 'docs',
        vectorSize: 4,
        distance: 'cosine',
        pointsCount: 42,
        status: 'green',
      });

      const [createUrl, createInit] = fetchMock.mock.calls[0];
      expect(createUrl).toBe('http://localhost:6333/collections/docs');
      expect(createInit.method).toBe('PUT');
      expect(JSON.parse(createInit.body)).toEqual({
        vectors: { size: 4, distance: 'Cosine' },
        on_disk_payload: false,
      });
    });

    it('deletes the existing collection first when recreateIfExists is set', async () => {
      fetchMock
        .mockResolvedValueOnce(fakeResponse(200, {})) // DELETE existing
        .mockResolvedValueOnce(fakeResponse(200, { result: { status: 'ok' } })) // PUT create
        .mockResolvedValueOnce(fakeResponse(200, COLLECTION_INFO_BODY)); // GET info

      const provider = createProvider();
      await provider.createCollection({ name: 'docs', vectorSize: 4, recreateIfExists: true });

      expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
      expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    });
  });

  describe('collectionExists', () => {
    it('returns true when the collection info request succeeds', async () => {
      fetchMock.mockResolvedValueOnce(fakeResponse(200, COLLECTION_INFO_BODY));
      const provider = createProvider();
      await expect(provider.collectionExists('docs')).resolves.toBe(true);
    });

    it('returns false when the collection is not found', async () => {
      fetchMock.mockResolvedValueOnce(fakeResponse(404, { status: 'Not found' }));
      const provider = createProvider();
      await expect(provider.collectionExists('missing')).resolves.toBe(false);
    });
  });

  describe('error mapping', () => {
    it('maps a 401 response to VectorStoreAuthenticationError', async () => {
      fetchMock.mockResolvedValueOnce(fakeResponse(401, { status: 'Unauthorized' }));
      const provider = createProvider();
      await expect(provider.getCollectionInfo('docs')).rejects.toBeInstanceOf(
        VectorStoreAuthenticationError
      );
    });

    it('maps a fetch rejection to VectorStoreConnectionError', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const provider = createProvider();
      await expect(provider.getCollectionInfo('docs')).rejects.toBeInstanceOf(
        VectorStoreConnectionError
      );
    });

    it('retries a 500 response and eventually succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce(fakeResponse(500, { status: 'internal error' }))
        .mockResolvedValueOnce(fakeResponse(200, COLLECTION_INFO_BODY));

      const provider = createProvider({ maxRetries: 1 });
      const info = await provider.getCollectionInfo('docs');
      expect(info.pointsCount).toBe(42);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('upsertBatch', () => {
    it('validates vector dimensions against the collection before upserting', async () => {
      fetchMock.mockResolvedValueOnce(fakeResponse(200, COLLECTION_INFO_BODY)); // dimension lookup

      const provider = createProvider();
      await expect(
        provider.upsertBatch('docs', [{ id: 1, vector: [1, 2, 3] }])
      ).rejects.toBeInstanceOf(VectorStoreDimensionMismatchError);
    });

    it('upserts points once the dimension check passes', async () => {
      fetchMock
        .mockResolvedValueOnce(fakeResponse(200, COLLECTION_INFO_BODY)) // dimension lookup
        .mockResolvedValueOnce(fakeResponse(200, { result: { status: 'acknowledged' } })); // PUT points

      const provider = createProvider();
      const result = await provider.upsertBatch('docs', [{ id: 1, vector: [0.1, 0.2, 0.3, 0.4] }]);

      expect(result).toEqual({ upsertedCount: 1, ids: [1] });
      const [, upsertInit] = fetchMock.mock.calls[1];
      expect(upsertInit.method).toBe('PUT');
    });
  });

  describe('search', () => {
    it('sends the query vector and maps scored points back', async () => {
      fetchMock
        .mockResolvedValueOnce(fakeResponse(200, COLLECTION_INFO_BODY)) // dimension lookup
        .mockResolvedValueOnce(
          fakeResponse(200, { result: [{ id: 'a', score: 0.9, payload: { text: 'hello' } }] })
        );

      const provider = createProvider();
      const results = await provider.search('docs', { vector: [0.1, 0.2, 0.3, 0.4], topK: 3 });

      expect(results).toEqual([
        { id: 'a', score: 0.9, payload: { text: 'hello' }, vector: undefined },
      ]);

      const [, searchInit] = fetchMock.mock.calls[1];
      const body = JSON.parse(searchInit.body);
      expect(body.limit).toBe(3);
      expect(body.vector).toEqual([0.1, 0.2, 0.3, 0.4]);
    });
  });

  describe('delete / count', () => {
    it('sends the ids to delete and reports them as the deleted count', async () => {
      fetchMock.mockResolvedValueOnce(fakeResponse(200, { result: { status: 'acknowledged' } }));
      const provider = createProvider();
      const result = await provider.delete('docs', [1, 2, 3]);
      expect(result).toEqual({ deletedCount: 3 });
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ points: [1, 2, 3] });
    });

    it('counts points matching a filter', async () => {
      fetchMock.mockResolvedValueOnce(fakeResponse(200, { result: { count: 12 } }));
      const provider = createProvider();
      const result = await provider.count('docs', {
        must: [{ key: 'tenantId', match: { value: 't1' } }],
      });
      expect(result).toBe(12);
    });
  });

  describe('deleteByFilter', () => {
    it('counts matches before deleting and reports that as deletedCount', async () => {
      fetchMock
        .mockResolvedValueOnce(fakeResponse(200, { result: { count: 7 } })) // count
        .mockResolvedValueOnce(fakeResponse(200, { result: { status: 'acknowledged' } })); // delete

      const provider = createProvider();
      const result = await provider.deleteByFilter('docs', {
        must: [{ key: 'documentId', match: { value: 'doc_1' } }],
      });

      expect(result).toEqual({ deletedCount: 7 });
    });
  });

  describe('healthCheck', () => {
    it('returns true when the health endpoint responds ok', async () => {
      fetchMock.mockResolvedValueOnce(fakeResponse(200, {}));
      const provider = createProvider();
      await expect(provider.healthCheck()).resolves.toBe(true);
    });

    it('returns false when the request fails', async () => {
      fetchMock.mockRejectedValueOnce(new Error('down'));
      const provider = createProvider();
      await expect(provider.healthCheck()).resolves.toBe(false);
    });
  });
});

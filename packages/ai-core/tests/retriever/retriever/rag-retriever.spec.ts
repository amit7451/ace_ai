import { RagRetriever } from '../../../src/retriever/retriever/rag-retriever';
import { RetrieverDimensionMismatchError } from '../../../src/retriever/errors/retriever.errors';
import type { IEmbeddingProvider } from '../../../src/embedding/interfaces/embedding-provider.interface';
import type { IVectorStore } from '../../../src/vector-store/interfaces/vector-store.interface';
import type { EmbeddingResponse } from '../../../src/embedding/types/embedding-response.types';
import type { CollectionInfo } from '../../../src/vector-store/types/collection.types';
import type { VectorSearchResult } from '../../../src/vector-store/types/search.types';
import type { KnowledgeVectorPayload } from '../../../src/vector-store/types/vector-record.types';
import type { IRerankStrategy } from '../../../src/retriever/interfaces/rerank-strategy.interface';

function embeddingResponse(vector: number[]): EmbeddingResponse {
  return {
    embeddings: [{ embedding: vector, index: 0 }],
    model: 'text-embedding-3-small',
    dimensions: vector.length,
    usage: { promptTokens: 4, totalTokens: 4 },
  };
}

function fakeEmbeddingProvider(overrides: Partial<IEmbeddingProvider> = {}): IEmbeddingProvider {
  return {
    name: 'openai',
    model: 'text-embedding-3-small',
    dimensions: 3,
    embed: jest.fn().mockResolvedValue(embeddingResponse([1, 0, 0])),
    embedBatch: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function collectionInfo(overrides: Partial<CollectionInfo> = {}): CollectionInfo {
  return {
    name: 'assistant_abc123',
    vectorSize: 3,
    distance: 'cosine',
    pointsCount: 42,
    status: 'green',
    ...overrides,
  };
}

function fakeVectorStore(overrides: Partial<IVectorStore> = {}): IVectorStore {
  return {
    provider: 'qdrant',
    createCollection: jest.fn(),
    getOrCreateCollection: jest.fn(),
    deleteCollection: jest.fn(),
    collectionExists: jest.fn(),
    getCollectionInfo: jest.fn().mockResolvedValue(collectionInfo()),
    upsert: jest.fn(),
    upsertBatch: jest.fn(),
    search: jest.fn().mockResolvedValue([]),
    getById: jest.fn(),
    delete: jest.fn(),
    deleteByFilter: jest.fn(),
    count: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function payload(overrides: Partial<KnowledgeVectorPayload> = {}): KnowledgeVectorPayload {
  return {
    tenantId: 'tenant_1',
    assistantId: 'assistant_abc123',
    documentId: 'doc_1',
    chunkId: 'chunk_1',
    chunkIndex: 0,
    text: 'Our refund policy allows returns within 30 days.',
    sourceType: 'document',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function searchResult(
  id: string,
  score: number,
  overrides: Partial<KnowledgeVectorPayload> = {}
): VectorSearchResult<KnowledgeVectorPayload> {
  return { id, score, payload: payload({ chunkId: id, ...overrides }) };
}

describe('RagRetriever', () => {
  it('embeds the query with inputType "query" and returns ranked chunks', async () => {
    const embedding = fakeEmbeddingProvider();
    const vectorStore = fakeVectorStore({
      search: jest
        .fn()
        .mockResolvedValue([
          searchResult('c1', 0.9),
          searchResult('c2', 0.8, { text: 'Different text entirely.' }),
        ]),
    });

    const retriever = new RagRetriever(embedding, vectorStore, { collection: 'assistant_abc123' });
    const result = await retriever.retrieve({
      query: 'What is your refund policy?',
      tenantId: 'tenant_1',
      assistantId: 'assistant_abc123',
    });

    expect(embedding.embed).toHaveBeenCalledWith('What is your refund policy?', {
      inputType: 'query',
    });
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0].chunkId).toBe('c1');
    expect(result.isRelevant).toBe(true);
    expect(result.query).toBe('What is your refund policy?');
    expect(typeof result.tookMs).toBe('number');
  });

  it('always ANDs tenantId and assistantId into the search filter', async () => {
    const searchMock = jest.fn().mockResolvedValue([]);
    const retriever = new RagRetriever(
      fakeEmbeddingProvider(),
      fakeVectorStore({ search: searchMock }),
      { collection: 'c' }
    );

    await retriever.retrieve({
      query: 'hello',
      tenantId: 'tenant_1',
      assistantId: 'assistant_abc123',
      filter: { must: [{ key: 'sourceType', match: { value: 'faq' } }] },
    });

    const [, searchQuery] = searchMock.mock.calls[0];
    expect(searchQuery.filter.must).toEqual(
      expect.arrayContaining([
        { key: 'tenantId', match: { value: 'tenant_1' } },
        { key: 'assistantId', match: { value: 'assistant_abc123' } },
        { key: 'sourceType', match: { value: 'faq' } },
      ])
    );
  });

  it('returns isRelevant: false and an empty chunk list when nothing clears the score threshold', async () => {
    const vectorStore = fakeVectorStore({
      search: jest.fn().mockResolvedValue([searchResult('c1', 0.1)]),
    });
    const retriever = new RagRetriever(fakeEmbeddingProvider(), vectorStore, {
      collection: 'c',
      scoreThreshold: 0.5,
    });

    const result = await retriever.retrieve({
      query: 'what is quantum physics?',
      tenantId: 'tenant_1',
      assistantId: 'assistant_abc123',
    });

    expect(result.chunks).toEqual([]);
    expect(result.isRelevant).toBe(false);
  });

  it('throws RetrieverDimensionMismatchError on every call while the mismatch persists (not cached as a permanent failure)', async () => {
    const getCollectionInfoMock = jest.fn().mockResolvedValue(collectionInfo({ vectorSize: 1536 }));
    const embedding = fakeEmbeddingProvider({ dimensions: 768, model: 'text-embedding-004' });
    const vectorStore = fakeVectorStore({ getCollectionInfo: getCollectionInfoMock });
    const retriever = new RagRetriever(embedding, vectorStore, { collection: 'assistant_abc123' });

    await expect(
      retriever.retrieve({ query: 'hi', tenantId: 't1', assistantId: 'a1' })
    ).rejects.toBeInstanceOf(RetrieverDimensionMismatchError);
    await expect(
      retriever.retrieve({ query: 'hi again', tenantId: 't1', assistantId: 'a1' })
    ).rejects.toBeInstanceOf(RetrieverDimensionMismatchError);

    // Only a *successful* verification is cached (see next test) — a
    // persistent mismatch keeps re-checking so the retriever self-heals
    // the moment an operator re-indexes the collection, without needing
    // to restart the process or construct a new RagRetriever.
    expect(getCollectionInfoMock).toHaveBeenCalledTimes(2);
  });

  it('caches a successful dimension verification so later calls skip the extra round trip', async () => {
    const getCollectionInfoMock = jest.fn().mockResolvedValue(collectionInfo({ vectorSize: 3 }));
    const vectorStore = fakeVectorStore({
      getCollectionInfo: getCollectionInfoMock,
      search: jest.fn().mockResolvedValue([]),
    });
    const retriever = new RagRetriever(fakeEmbeddingProvider(), vectorStore, {
      collection: 'assistant_abc123',
    });

    await retriever.retrieve({ query: 'hi', tenantId: 't1', assistantId: 'a1' });
    await retriever.retrieve({ query: 'hi again', tenantId: 't1', assistantId: 'a1' });

    expect(getCollectionInfoMock).toHaveBeenCalledTimes(1);
  });

  it('requests candidate vectors only when the configured strategy needs them', async () => {
    const searchMock = jest.fn().mockResolvedValue([]);
    const defaultRetriever = new RagRetriever(
      fakeEmbeddingProvider(),
      fakeVectorStore({ search: searchMock }),
      { collection: 'c' }
    );
    await defaultRetriever.retrieve({ query: 'hi', tenantId: 't1', assistantId: 'a1' });
    expect(searchMock.mock.calls[0][1].withVector).toBe(false);

    searchMock.mockClear();
    const mmrRetriever = new RagRetriever(
      fakeEmbeddingProvider(),
      fakeVectorStore({ search: searchMock }),
      {
        collection: 'c',
        strategy: 'mmr',
      }
    );
    await mmrRetriever.retrieve({ query: 'hi', tenantId: 't1', assistantId: 'a1' });
    expect(searchMock.mock.calls[0][1].withVector).toBe(true);
  });

  it('accepts an injected custom rerank strategy instead of using the factory', async () => {
    const customStrategy: IRerankStrategy = {
      name: 'similarity-threshold',
      requiresVectors: false,
      rerank: jest.fn().mockReturnValue([searchResult('custom', 0.99)]),
    };
    const retriever = new RagRetriever(
      fakeEmbeddingProvider(),
      fakeVectorStore(),
      { collection: 'c' },
      customStrategy
    );

    const result = await retriever.retrieve({ query: 'hi', tenantId: 't1', assistantId: 'a1' });

    expect(customStrategy.rerank).toHaveBeenCalled();
    expect(result.chunks[0].chunkId).toBe('custom');
  });

  it('deduplicates near-identical chunk text across results', async () => {
    const sameText = 'Our refund policy allows returns within 30 days.';
    const vectorStore = fakeVectorStore({
      search: jest
        .fn()
        .mockResolvedValue([
          searchResult('c1', 0.9, { text: sameText }),
          searchResult('c2', 0.8, { text: sameText }),
        ]),
    });
    const retriever = new RagRetriever(fakeEmbeddingProvider(), vectorStore, { collection: 'c' });

    const result = await retriever.retrieve({
      query: 'refund?',
      tenantId: 't1',
      assistantId: 'a1',
    });

    expect(result.chunks).toHaveLength(1);
  });

  it('trims to maxContextTokens when configured', async () => {
    const longText = 'a'.repeat(400); // ~100 tokens
    const vectorStore = fakeVectorStore({
      search: jest
        .fn()
        .mockResolvedValue([
          searchResult('c1', 0.9, { text: longText }),
          searchResult('c2', 0.8, { text: longText }),
          searchResult('c3', 0.7, { text: longText }),
        ]),
    });
    const retriever = new RagRetriever(fakeEmbeddingProvider(), vectorStore, {
      collection: 'c',
      maxContextTokens: 150,
    });

    const result = await retriever.retrieve({ query: 'hi', tenantId: 't1', assistantId: 'a1' });

    expect(result.chunks.length).toBeLessThan(3);
  });

  it('per-query topK/scoreThreshold override the retriever-level config', async () => {
    const searchMock = jest.fn().mockResolvedValue([searchResult('c1', 0.6)]);
    const retriever = new RagRetriever(
      fakeEmbeddingProvider(),
      fakeVectorStore({ search: searchMock }),
      {
        collection: 'c',
        scoreThreshold: 0.9,
      }
    );

    const result = await retriever.retrieve({
      query: 'hi',
      tenantId: 't1',
      assistantId: 'a1',
      scoreThreshold: 0.5,
    });

    expect(result.chunks).toHaveLength(1);
  });

  describe('healthCheck', () => {
    it('returns true when both dependencies are healthy', async () => {
      const retriever = new RagRetriever(fakeEmbeddingProvider(), fakeVectorStore(), {
        collection: 'c',
      });
      await expect(retriever.healthCheck()).resolves.toBe(true);
    });

    it('returns false when the embedding provider is unhealthy', async () => {
      const retriever = new RagRetriever(
        fakeEmbeddingProvider({ healthCheck: jest.fn().mockResolvedValue(false) }),
        fakeVectorStore(),
        {
          collection: 'c',
        }
      );
      await expect(retriever.healthCheck()).resolves.toBe(false);
    });

    it('never throws, even if a dependency healthCheck rejects', async () => {
      const retriever = new RagRetriever(
        fakeEmbeddingProvider({
          healthCheck: jest.fn().mockRejectedValue(new Error('network down')),
        }),
        fakeVectorStore(),
        { collection: 'c' }
      );
      await expect(retriever.healthCheck()).resolves.toBe(false);
    });
  });
});

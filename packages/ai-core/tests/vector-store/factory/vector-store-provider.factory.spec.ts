import { VectorStoreProviderFactory } from '../../../src/vector-store/factory/vector-store-provider.factory';
import { QdrantVectorStoreProvider } from '../../../src/vector-store/providers/qdrant/qdrant-vector-store.provider';
import { VectorStoreInvalidRequestError } from '../../../src/vector-store/errors/vector-store.errors';

describe('VectorStoreProviderFactory', () => {
  it('creates a QdrantVectorStoreProvider for a valid qdrant config', () => {
    const store = VectorStoreProviderFactory.create({
      provider: 'qdrant',
      url: 'http://localhost:6333',
    });
    expect(store).toBeInstanceOf(QdrantVectorStoreProvider);
    expect(store.provider).toBe('qdrant');
  });

  it('throws VectorStoreInvalidRequestError for an invalid url', () => {
    expect(() =>
      VectorStoreProviderFactory.create({ provider: 'qdrant', url: 'not-a-url' })
    ).toThrow(VectorStoreInvalidRequestError);
  });

  it('throws VectorStoreInvalidRequestError for an unsupported provider', () => {
    expect(() =>
      VectorStoreProviderFactory.create({
        // @ts-expect-error deliberately invalid input, exercising runtime validation
        provider: 'pinecone',
        url: 'http://localhost:6333',
      })
    ).toThrow(VectorStoreInvalidRequestError);
  });
});

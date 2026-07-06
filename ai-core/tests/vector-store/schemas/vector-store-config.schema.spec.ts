import {
  vectorStoreConfigSchema,
  createCollectionConfigSchema,
} from '../../../src/vector-store/schemas/vector-store-config.schema';

describe('vectorStoreConfigSchema', () => {
  it('accepts a minimal valid config', () => {
    const result = vectorStoreConfigSchema.safeParse({ provider: 'qdrant', url: 'http://localhost:6333' });
    expect(result.success).toBe(true);
  });

  it('accepts a fully specified config', () => {
    const result = vectorStoreConfigSchema.safeParse({
      provider: 'qdrant',
      url: 'https://my-cluster.cloud.qdrant.io:6333',
      apiKey: 'secret',
      timeout: 5000,
      maxRetries: 5,
      maxBatchSize: 100,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing url', () => {
    const result = vectorStoreConfigSchema.safeParse({ provider: 'qdrant' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-URL string for url', () => {
    const result = vectorStoreConfigSchema.safeParse({ provider: 'qdrant', url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported provider', () => {
    const result = vectorStoreConfigSchema.safeParse({ provider: 'pinecone', url: 'http://localhost:6333' });
    expect(result.success).toBe(false);
  });
});

describe('createCollectionConfigSchema', () => {
  it('accepts a valid collection config', () => {
    const result = createCollectionConfigSchema.safeParse({ name: 'kb_assistant_123', vectorSize: 1536 });
    expect(result.success).toBe(true);
  });

  it('rejects a name with invalid characters', () => {
    const result = createCollectionConfigSchema.safeParse({ name: 'kb assistant!', vectorSize: 1536 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive vector size', () => {
    const result = createCollectionConfigSchema.safeParse({ name: 'kb', vectorSize: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported distance metric', () => {
    const result = createCollectionConfigSchema.safeParse({ name: 'kb', vectorSize: 128, distance: 'hamming' });
    expect(result.success).toBe(false);
  });
});

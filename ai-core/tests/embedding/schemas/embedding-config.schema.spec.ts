import { embeddingConfigSchema } from '../../../src/embedding/schemas/embedding-config.schema';

describe('embeddingConfigSchema', () => {
  it('accepts a valid openai config and applies defaults', () => {
    const parsed = embeddingConfigSchema.parse({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
    });
    expect(parsed.maxRetries).toBe(3);
    expect(parsed.timeoutMs).toBe(30_000);
    expect(parsed.defaultInputType).toBe('document');
  });

  it('accepts an ollama config without an apiKey', () => {
    const parsed = embeddingConfigSchema.parse({
      provider: 'ollama',
      model: 'nomic-embed-text',
    });
    expect(parsed.provider).toBe('ollama');
  });

  it('rejects a non-ollama config missing an apiKey', () => {
    expect(() =>
      embeddingConfigSchema.parse({
        provider: 'cohere',
        model: 'embed-english-v3.0',
      }),
    ).toThrow();
  });

  it('rejects an unknown provider', () => {
    expect(() =>
      embeddingConfigSchema.parse({
        provider: 'unknown-vendor',
        model: 'x',
        apiKey: 'k',
      }),
    ).toThrow();
  });

  it('rejects an empty model string', () => {
    expect(() =>
      embeddingConfigSchema.parse({
        provider: 'openai',
        apiKey: 'sk-test',
        model: '',
      }),
    ).toThrow();
  });

  it('rejects a timeoutMs below the allowed minimum', () => {
    expect(() =>
      embeddingConfigSchema.parse({
        provider: 'openai',
        apiKey: 'sk-test',
        model: 'text-embedding-3-small',
        timeoutMs: 10,
      }),
    ).toThrow();
  });
});

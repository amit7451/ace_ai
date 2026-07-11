import { EmbeddingProviderFactory } from '../../../src/embedding/factory/embedding-provider.factory';
import { OpenAIEmbeddingProvider } from '../../../src/embedding/providers/openai/openai-embedding.provider';
import { GeminiEmbeddingProvider } from '../../../src/embedding/providers/gemini/gemini-embedding.provider';
import { CohereEmbeddingProvider } from '../../../src/embedding/providers/cohere/cohere-embedding.provider';
import { OllamaEmbeddingProvider } from '../../../src/embedding/providers/ollama/ollama-embedding.provider';

describe('EmbeddingProviderFactory', () => {
  it('creates an OpenAIEmbeddingProvider with the correct known dimensions', () => {
    const provider = EmbeddingProviderFactory.create({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
    });
    expect(provider).toBeInstanceOf(OpenAIEmbeddingProvider);
    expect(provider.name).toBe('openai');
    expect(provider.dimensions).toBe(1536);
  });

  it('creates a GeminiEmbeddingProvider', () => {
    const provider = EmbeddingProviderFactory.create({
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'text-embedding-004',
    });
    expect(provider).toBeInstanceOf(GeminiEmbeddingProvider);
    expect(provider.dimensions).toBe(768);
  });

  it('creates a CohereEmbeddingProvider', () => {
    const provider = EmbeddingProviderFactory.create({
      provider: 'cohere',
      apiKey: 'test-key',
      model: 'embed-english-v3.0',
    });
    expect(provider).toBeInstanceOf(CohereEmbeddingProvider);
    expect(provider.dimensions).toBe(1024);
  });

  it('creates an OllamaEmbeddingProvider without requiring an apiKey', () => {
    const provider = EmbeddingProviderFactory.create({
      provider: 'ollama',
      model: 'nomic-embed-text',
    });
    expect(provider).toBeInstanceOf(OllamaEmbeddingProvider);
    expect(provider.dimensions).toBe(768);
  });

  it('honors an explicit dimensions override over the known-model default', () => {
    const provider = EmbeddingProviderFactory.create({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'text-embedding-3-large',
      dimensions: 1024,
    });
    expect(provider.dimensions).toBe(1024);
  });

  it('throws when a non-ollama provider is missing an apiKey', () => {
    expect(() =>
      EmbeddingProviderFactory.create({
        provider: 'openai',
        model: 'text-embedding-3-small',
      } as never)
    ).toThrow();
  });

  it('throws for an unsupported provider name', () => {
    expect(() =>
      EmbeddingProviderFactory.create({
        provider: 'unsupported' as never,
        model: 'x',
        apiKey: 'k',
      })
    ).toThrow();
  });
});

import { OllamaEmbeddingProvider } from '../../../../src/embedding/providers/ollama/ollama-embedding.provider';

describe('OllamaEmbeddingProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it('embeds without requiring an apiKey and hits the local default base URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ embeddings: [new Array(768).fill(0.1)], prompt_eval_count: 4 }),
      text: async () => '',
    });

    const provider = new OllamaEmbeddingProvider({
      provider: 'ollama',
      model: 'nomic-embed-text',
    });

    const result = await provider.embed('hello');
    expect(result.dimensions).toBe(768);
    expect(result.usage.totalTokens).toBe(4);

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/embed');
  });

  it('respects a custom baseUrl override', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ embeddings: [new Array(768).fill(0)] }),
      text: async () => '',
    });

    const provider = new OllamaEmbeddingProvider({
      provider: 'ollama',
      model: 'nomic-embed-text',
      baseUrl: 'http://custom-host:11434',
    });

    await provider.embed('hi');
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://custom-host:11434/api/embed');
  });

  it('healthCheck pings /api/tags rather than performing a full embed', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, status: 200 });

    const provider = new OllamaEmbeddingProvider({
      provider: 'ollama',
      model: 'nomic-embed-text',
    });

    const healthy = await provider.healthCheck();
    expect(healthy).toBe(true);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/tags');
  });

  it('healthCheck returns false when the server is unreachable', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const provider = new OllamaEmbeddingProvider({
      provider: 'ollama',
      model: 'nomic-embed-text',
    });

    expect(await provider.healthCheck()).toBe(false);
  });
});

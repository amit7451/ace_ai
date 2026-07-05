import { GeminiEmbeddingProvider } from '../../../../src/embedding/providers/gemini/gemini-embedding.provider';
import { EmbeddingProviderUnavailableError } from '../../../../src/embedding/errors/embedding.errors';

describe('GeminiEmbeddingProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it('embeds inputs and maps taskType based on inputType', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        embeddings: [{ values: new Array(768).fill(0.1) }],
      }),
      text: async () => '',
    });

    const provider = new GeminiEmbeddingProvider({
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'text-embedding-004',
    });

    const result = await provider.embed('what is the refund policy?', { inputType: 'query' });
    expect(result.embeddings).toHaveLength(1);
    expect(result.dimensions).toBe(768);

    const [url, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('batchEmbedContents');
    expect(url).toContain('key=test-key');
    const body = JSON.parse(requestInit.body);
    expect(body.requests[0].taskType).toBe('RETRIEVAL_QUERY');
  });

  it('defaults to RETRIEVAL_DOCUMENT when no inputType is given', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ embeddings: [{ values: new Array(768).fill(0) }] }),
      text: async () => '',
    });

    const provider = new GeminiEmbeddingProvider({
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'text-embedding-004',
    });

    await provider.embed('some company policy text');
    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(requestInit.body).requests[0].taskType).toBe('RETRIEVAL_DOCUMENT');
  });

  it('estimates usage tokens since Gemini does not return them', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ embeddings: [{ values: new Array(768).fill(0) }] }),
      text: async () => '',
    });

    const provider = new GeminiEmbeddingProvider({
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'text-embedding-004',
    });

    const result = await provider.embed('abcd'); // 4 chars -> ceil(4/4) = 1 estimated token
    expect(result.usage.totalTokens).toBe(1);
  });

  it('maps a 503 response to EmbeddingProviderUnavailableError', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'overloaded',
    });

    const provider = new GeminiEmbeddingProvider({
      provider: 'gemini',
      apiKey: 'test-key',
      model: 'text-embedding-004',
      maxRetries: 0,
    });

    await expect(provider.embed('hi')).rejects.toBeInstanceOf(EmbeddingProviderUnavailableError);
  });
});

import { OpenAIEmbeddingProvider } from '../../../../src/embedding/providers/openai/openai-embedding.provider';
import {
  EmbeddingAuthenticationError,
  EmbeddingDimensionMismatchError,
} from '../../../../src/embedding/errors/embedding.errors';

describe('OpenAIEmbeddingProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it('embeds a single input', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ embedding: new Array(1536).fill(0.01), index: 0 }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 5, total_tokens: 5 },
      }),
      text: async () => '',
      headers: { get: () => null },
    });

    const provider = new OpenAIEmbeddingProvider({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
    });

    const result = await provider.embed('hello world');
    expect(result.embeddings).toHaveLength(1);
    expect(result.dimensions).toBe(1536);
    expect(result.usage.totalTokens).toBe(5);

    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(requestInit.headers.Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(requestInit.body).input).toEqual(['hello world']);
  });

  it('sends "dimensions" only for the text-embedding-3-* family', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ embedding: new Array(512).fill(0), index: 0 }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 1, total_tokens: 1 },
      }),
      text: async () => '',
      headers: { get: () => null },
    });

    const provider = new OpenAIEmbeddingProvider({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
      dimensions: 512,
    });

    await provider.embed('hi');
    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(requestInit.body).dimensions).toBe(512);
  });

  it('automatically chunks batches larger than the configured max batch size and reassembles in order', async () => {
    const makeResponse = (n: number) => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: Array.from({ length: n }, (_, i) => ({
          embedding: new Array(1536).fill(0),
          index: i,
        })),
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: n, total_tokens: n },
      }),
      text: async () => '',
      headers: { get: () => null },
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(makeResponse(2))
      .mockResolvedValueOnce(makeResponse(1));

    const provider = new OpenAIEmbeddingProvider({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
      maxBatchSize: 2, // force chunking for the test
    });

    const result = await provider.embedBatch(['a', 'b', 'c']);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.embeddings).toHaveLength(3);
    expect(result.embeddings.map((e) => e.index)).toEqual([0, 1, 2]);
    expect(result.usage.totalTokens).toBe(3);
  });

  it('maps a 401 response to EmbeddingAuthenticationError and does not retry', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
      text: async () => 'Invalid API key',
      headers: { get: () => null },
    });

    const provider = new OpenAIEmbeddingProvider({
      provider: 'openai',
      apiKey: 'bad-key',
      model: 'text-embedding-3-small',
      maxRetries: 2,
    });

    await expect(provider.embed('hello')).rejects.toBeInstanceOf(EmbeddingAuthenticationError);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on a 429 and eventually succeeds', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'rate limited',
        headers: { get: () => '0' },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ embedding: new Array(1536).fill(0), index: 0 }],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 1, total_tokens: 1 },
        }),
        text: async () => '',
        headers: { get: () => null },
      });

    const provider = new OpenAIEmbeddingProvider({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'text-embedding-3-small',
      maxRetries: 1,
    });

    const result = await provider.embed('hi');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(result.embeddings).toHaveLength(1);
  });

  it('throws EmbeddingDimensionMismatchError when the response dims disagree with the configured/known dims', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [{ embedding: new Array(999).fill(0), index: 0 }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 1, total_tokens: 1 },
      }),
      text: async () => '',
      headers: { get: () => null },
    });

    const provider = new OpenAIEmbeddingProvider({
      provider: 'openai',
      apiKey: 'sk-test',
      model: 'text-embedding-3-small', // known dims = 1536, response returns 999
      maxRetries: 0,
    });

    await expect(provider.embed('hi')).rejects.toBeInstanceOf(EmbeddingDimensionMismatchError);
  });
});

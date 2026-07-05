import { CohereEmbeddingProvider } from '../../../../src/embedding/providers/cohere/cohere-embedding.provider';

describe('CohereEmbeddingProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it('maps inputType to Cohere-specific input_type values', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        embeddings: { float: [new Array(1024).fill(0.2)] },
        meta: { billed_units: { input_tokens: 3 } },
      }),
      text: async () => '',
    });

    const provider = new CohereEmbeddingProvider({
      provider: 'cohere',
      apiKey: 'test-key',
      model: 'embed-english-v3.0',
    });

    const result = await provider.embed('search this', { inputType: 'query' });
    expect(result.dimensions).toBe(1024);
    expect(result.usage.totalTokens).toBe(3);

    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(requestInit.body).input_type).toBe('search_query');
  });

  it('defaults input_type to search_document', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ embeddings: { float: [new Array(1024).fill(0)] } }),
      text: async () => '',
    });

    const provider = new CohereEmbeddingProvider({
      provider: 'cohere',
      apiKey: 'test-key',
      model: 'embed-english-v3.0',
    });

    await provider.embed('a knowledge base chunk');
    const [, requestInit] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(requestInit.body).input_type).toBe('search_document');
  });

  it('handles the flat embeddings array response shape as well as the {float:} shape', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ embeddings: [new Array(1024).fill(0.5)] }),
      text: async () => '',
    });

    const provider = new CohereEmbeddingProvider({
      provider: 'cohere',
      apiKey: 'test-key',
      model: 'embed-english-v3.0',
    });

    const result = await provider.embed('hi');
    expect(result.embeddings).toHaveLength(1);
  });
});

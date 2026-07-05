import { OllamaProvider } from '../../../src/llm/providers/ollama/ollama.provider';
import { jsonResponse, errorResponse, sseResponse } from '../test-utils/mock-fetch';

describe('OllamaProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not require an apiKey', () => {
    expect(() => new OllamaProvider({ provider: 'ollama', model: 'llama3' })).not.toThrow();
  });

  it('defaults to the local Ollama server URL', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, { model: 'llama3', message: { role: 'assistant', content: 'hi' }, done: true })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OllamaProvider({ provider: 'ollama', model: 'llama3' });
    await provider.complete([{ role: 'user', content: 'Hi' }]);

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:11434/api/chat');
  });

  it('parses a non-streaming chat response', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        model: 'llama3',
        message: { role: 'assistant', content: 'Hi there' },
        done: true,
        prompt_eval_count: 5,
        eval_count: 3,
      })
    ) as unknown as typeof fetch;

    const provider = new OllamaProvider({ provider: 'ollama', model: 'llama3' });
    const result = await provider.complete([{ role: 'user', content: 'Hi' }]);

    expect(result.content).toBe('Hi there');
    expect(result.usage.totalTokens).toBe(8);
  });

  it('parses newline-delimited streaming chunks', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      sseResponse([
        '{"model":"llama3","message":{"role":"assistant","content":"Hel"},"done":false}\n',
        '{"model":"llama3","message":{"role":"assistant","content":"lo"},"done":false}\n',
        '{"model":"llama3","message":{"role":"assistant","content":""},"done":true,"prompt_eval_count":4,"eval_count":2}\n',
      ])
    ) as unknown as typeof fetch;

    const provider = new OllamaProvider({ provider: 'ollama', model: 'llama3' });
    const chunks = [];
    for await (const chunk of provider.stream([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks.map((c) => c.delta).join('')).toBe('Hello');
    expect(chunks[chunks.length - 1].isFinal).toBe(true);
    expect(chunks[chunks.length - 1].usage?.totalTokens).toBe(6);
  });

  it('gives a helpful error when the model has not been pulled locally', async () => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(404, 'model not found')) as unknown as typeof fetch;
    const provider = new OllamaProvider({ provider: 'ollama', model: 'does-not-exist' });
    await expect(provider.complete([{ role: 'user', content: 'Hi' }])).rejects.toThrow(/ollama pull/);
  });

  it('reports healthy when the local server responds', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;
    const provider = new OllamaProvider({ provider: 'ollama', model: 'llama3' });
    await expect(provider.healthCheck()).resolves.toBe(true);
  });

  it('reports unhealthy when the local server is unreachable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;
    const provider = new OllamaProvider({ provider: 'ollama', model: 'llama3' });
    await expect(provider.healthCheck()).resolves.toBe(false);
  });
});

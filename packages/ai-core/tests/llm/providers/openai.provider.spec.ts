import { OpenAIProvider } from '../../../src/llm/providers/openai/openai.provider';
import { LLMAuthenticationError } from '../../../src/llm/errors/llm.errors';
import { jsonResponse, errorResponse, sseResponse } from '../test-utils/mock-fetch';

describe('OpenAIProvider', () => {
  const config = { provider: 'openai' as const, apiKey: 'sk-test', model: 'gpt-4o-mini' };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('parses a successful completion response', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        model: 'gpt-4o-mini',
        choices: [
          { message: { role: 'assistant', content: 'Hello there' }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      })
    ) as unknown as typeof fetch;

    const provider = new OpenAIProvider(config);
    const result = await provider.complete([{ role: 'user', content: 'Hi' }]);

    expect(result.content).toBe('Hello there');
    expect(result.usage.totalTokens).toBe(15);
    expect(result.finishReason).toBe('stop');
    expect(result.provider).toBe('openai');
  });

  it('sends the Authorization bearer header and organization header when configured', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        model: 'gpt-4o-mini',
        choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OpenAIProvider({ ...config, organization: 'org-123' });
    await provider.complete([{ role: 'user', content: 'Hi' }]);

    const [, requestInit] = fetchMock.mock.calls[0];
    const headers = (requestInit as { headers: Record<string, string> }).headers;
    expect(headers.Authorization).toBe('Bearer sk-test');
    expect(headers['OpenAI-Organization']).toBe('org-123');
  });

  it('maps a 401 response to LLMAuthenticationError', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(errorResponse(401, 'invalid api key')) as unknown as typeof fetch;

    const provider = new OpenAIProvider(config);
    await expect(provider.complete([{ role: 'user', content: 'Hi' }])).rejects.toBeInstanceOf(
      LLMAuthenticationError
    );
  });

  it('maps a 429 response to a retryable error and succeeds after retrying', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(errorResponse(429, 'rate limited'))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          model: 'gpt-4o-mini',
          choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        })
      );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OpenAIProvider({ ...config, maxRetries: 2, retryBaseDelayMs: 1 });
    const result = await provider.complete([{ role: 'user', content: 'Hi' }]);

    expect(result.content).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('streams content deltas and a final usage chunk', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"Hel"},"finish_reason":null}]}\n\n',
          'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":null}]}\n\n',
          'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}\n\n',
          'data: [DONE]\n\n',
        ])
      ) as unknown as typeof fetch;

    const provider = new OpenAIProvider(config);
    const chunks = [];
    for await (const chunk of provider.stream([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks.map((c) => c.delta).join('')).toBe('Hello');
    expect(chunks[chunks.length - 1].isFinal).toBe(true);
    expect(chunks[chunks.length - 1].usage?.totalTokens).toBe(5);
  });

  it('estimates tokens via the shared heuristic', () => {
    const provider = new OpenAIProvider(config);
    expect(provider.estimateTokens([{ role: 'user', content: 'a'.repeat(8) }])).toBeGreaterThan(0);
  });
});

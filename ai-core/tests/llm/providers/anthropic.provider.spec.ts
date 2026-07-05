import { AnthropicProvider } from '../../../src/llm/providers/anthropic/anthropic.provider';
import { jsonResponse, errorResponse, sseResponse } from '../test-utils/mock-fetch';

describe('AnthropicProvider', () => {
  const config = { provider: 'anthropic' as const, apiKey: 'sk-ant-test', model: 'claude-3-5-sonnet-latest' };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('separates the system message from the conversation and parses the response', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 'msg_1',
        model: 'claude-3-5-sonnet-latest',
        content: [{ type: 'text', text: 'Hi human' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 12, output_tokens: 4 },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new AnthropicProvider(config);
    const result = await provider.complete([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Hello' },
    ]);

    expect(result.content).toBe('Hi human');
    expect(result.finishReason).toBe('stop');
    expect(result.usage.totalTokens).toBe(16);

    const [, requestInit] = fetchMock.mock.calls[0];
    const requestBody = JSON.parse((requestInit as { body: string }).body);
    expect(requestBody.system).toBe('You are a helpful assistant.');
    expect(requestBody.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    expect(requestBody.max_tokens).toBeDefined();
  });

  it('sends the x-api-key and anthropic-version headers', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        id: 'msg_1',
        model: 'claude-3-5-sonnet-latest',
        content: [{ type: 'text', text: 'ok' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new AnthropicProvider(config);
    await provider.complete([{ role: 'user', content: 'Hi' }]);

    const [, requestInit] = fetchMock.mock.calls[0];
    const headers = (requestInit as { headers: Record<string, string> }).headers;
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('maps a 401 response to an authentication error', async () => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(401, 'bad key')) as unknown as typeof fetch;
    const provider = new AnthropicProvider(config);
    await expect(provider.complete([{ role: 'user', content: 'Hi' }])).rejects.toMatchObject({ code: 'AUTHENTICATION_ERROR' });
  });

  it('streams text deltas from content_block_delta events and a final usage chunk', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      sseResponse([
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":0}}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hel"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"lo"}}\n\n',
        'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":2}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ])
    ) as unknown as typeof fetch;

    const provider = new AnthropicProvider(config);
    const chunks = [];
    for await (const chunk of provider.stream([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks.map((c) => c.delta).join('')).toBe('Hello');
    const finalChunk = chunks[chunks.length - 1];
    expect(finalChunk.isFinal).toBe(true);
    expect(finalChunk.usage?.promptTokens).toBe(10);
    expect(finalChunk.usage?.completionTokens).toBe(2);
  });
});

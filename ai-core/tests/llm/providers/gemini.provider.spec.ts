import { GeminiProvider } from '../../../src/llm/providers/gemini/gemini.provider';
import { jsonResponse, errorResponse, sseResponse } from '../test-utils/mock-fetch';

describe('GeminiProvider', () => {
  const config = { provider: 'gemini' as const, apiKey: 'gm-test', model: 'gemini-1.5-flash' };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps assistant role to "model" and separates the system instruction', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        candidates: [{ content: { parts: [{ text: 'Hi there' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 3, totalTokenCount: 11 },
      })
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new GeminiProvider(config);
    const result = await provider.complete([
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
      { role: 'user', content: 'How are you?' },
    ]);

    expect(result.content).toBe('Hi there');
    expect(result.finishReason).toBe('stop');
    expect(result.usage.totalTokens).toBe(11);

    const [, requestInit] = fetchMock.mock.calls[0];
    const requestBody = JSON.parse((requestInit as { body: string }).body);
    expect(requestBody.systemInstruction.parts[0].text).toBe('Be concise.');
    expect(requestBody.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
  });

  it('uses the x-goog-api-key header rather than exposing the key in the URL', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { candidates: [{ content: { parts: [{ text: 'ok' }] }, finishReason: 'STOP' }] }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new GeminiProvider(config);
    await provider.complete([{ role: 'user', content: 'Hi' }]);

    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url as string).not.toContain('gm-test');
    const headers = (requestInit as { headers: Record<string, string> }).headers;
    expect(headers['x-goog-api-key']).toBe('gm-test');
  });

  it('maps a 403 response to an authentication error', async () => {
    global.fetch = jest.fn().mockResolvedValue(errorResponse(403, 'forbidden')) as unknown as typeof fetch;
    const provider = new GeminiProvider(config);
    await expect(provider.complete([{ role: 'user', content: 'Hi' }])).rejects.toMatchObject({ code: 'AUTHENTICATION_ERROR' });
  });

  it('maps MAX_TOKENS and SAFETY finish reasons', async () => {
    const lengthResponse = jsonResponse(200, {
      candidates: [{ content: { parts: [{ text: 'cut off' }] }, finishReason: 'MAX_TOKENS' }],
    });
    global.fetch = jest.fn().mockResolvedValue(lengthResponse) as unknown as typeof fetch;
    const provider = new GeminiProvider(config);
    const result = await provider.complete([{ role: 'user', content: 'Hi' }]);
    expect(result.finishReason).toBe('length');

    const safetyResponse = jsonResponse(200, {
      candidates: [{ content: { parts: [{ text: '' }] }, finishReason: 'SAFETY' }],
    });
    global.fetch = jest.fn().mockResolvedValue(safetyResponse) as unknown as typeof fetch;
    const result2 = await provider.complete([{ role: 'user', content: 'Hi' }]);
    expect(result2.finishReason).toBe('content_filter');
  });

  it('streams SSE chunks using the alt=sse query parameter', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      sseResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"Hel"}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"lo"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":2,"candidatesTokenCount":2,"totalTokenCount":4}}\n\n',
      ])
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new GeminiProvider(config);
    const chunks = [];
    for await (const chunk of provider.stream([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk);
    }

    expect(chunks.map((c) => c.delta).join('')).toBe('Hello');
    expect(chunks[chunks.length - 1].isFinal).toBe(true);
    expect(chunks[chunks.length - 1].usage?.totalTokens).toBe(4);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(':streamGenerateContent?alt=sse');
  });
});

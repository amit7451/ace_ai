import { OpenRouterProvider } from '../../../src/llm/providers/openrouter/openrouter.provider';
import { jsonResponse } from '../test-utils/mock-fetch';

function successBody() {
  return {
    model: 'openai/gpt-4o-mini',
    choices: [{ message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

describe('OpenRouterProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the OpenRouter OpenAI-compatible endpoint by default', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, successBody()));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OpenRouterProvider({ provider: 'openrouter', apiKey: 'or-test', model: 'openai/gpt-4o-mini' });
    expect(provider.name).toBe('openrouter');

    await provider.complete([{ role: 'user', content: 'Hi' }]);

    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions');
  });

  it('forwards extraHeaders such as HTTP-Referer and X-Title', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, successBody()));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new OpenRouterProvider({
      provider: 'openrouter',
      apiKey: 'or-test',
      model: 'openai/gpt-4o-mini',
      extraHeaders: { 'HTTP-Referer': 'https://example.com', 'X-Title': 'Acme Support Bot' },
    });

    await provider.complete([{ role: 'user', content: 'Hi' }]);

    const [, requestInit] = fetchMock.mock.calls[0];
    const headers = (requestInit as { headers: Record<string, string> }).headers;
    expect(headers['HTTP-Referer']).toBe('https://example.com');
    expect(headers['X-Title']).toBe('Acme Support Bot');
  });
});

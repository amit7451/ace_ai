import { GroqProvider } from '../../../src/llm/providers/groq/groq.provider';
import { jsonResponse } from '../test-utils/mock-fetch';

function successBody() {
  return {
    model: 'llama-3.3-70b-versatile',
    choices: [{ message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

describe('GroqProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the Groq OpenAI-compatible endpoint by default', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, successBody()));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new GroqProvider({
      provider: 'groq',
      apiKey: 'gsk-test',
      model: 'llama-3.3-70b-versatile',
    });
    expect(provider.name).toBe('groq');

    await provider.complete([{ role: 'user', content: 'Hi' }]);

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('respects a custom baseUrl override', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, successBody()));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new GroqProvider({
      provider: 'groq',
      apiKey: 'gsk-test',
      model: 'llama-3.3-70b-versatile',
      baseUrl: 'https://my-proxy.internal/openai/v1',
    });

    await provider.complete([{ role: 'user', content: 'Hi' }]);
    expect(fetchMock.mock.calls[0][0]).toBe('https://my-proxy.internal/openai/v1/chat/completions');
  });

  it('still requires an apiKey (inherited from BaseLLMProvider)', () => {
    expect(
      () => new GroqProvider({ provider: 'groq', model: 'llama-3.3-70b-versatile' })
    ).toThrow();
  });
});

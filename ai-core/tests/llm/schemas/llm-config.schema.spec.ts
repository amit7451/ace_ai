import {
  LLMProviderConfigSchema,
  parseLLMProviderConfig,
  safeParseLLMProviderConfig,
} from '../../../src/llm/schemas/llm-config.schema';

describe('LLMProviderConfigSchema', () => {
  it('accepts a valid cloud provider config', () => {
    const result = LLMProviderConfigSchema.safeParse({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o-mini' });
    expect(result.success).toBe(true);
  });

  it('accepts an ollama config without an apiKey', () => {
    const result = LLMProviderConfigSchema.safeParse({ provider: 'ollama', model: 'llama3' });
    expect(result.success).toBe(true);
  });

  it('rejects a cloud provider config missing an apiKey', () => {
    const result = LLMProviderConfigSchema.safeParse({ provider: 'anthropic', model: 'claude-3-5-sonnet-latest' });
    expect(result.success).toBe(false);
  });

  it('rejects an unsupported provider name', () => {
    const result = LLMProviderConfigSchema.safeParse({ provider: 'unknown-provider', apiKey: 'x', model: 'x' });
    expect(result.success).toBe(false);
  });

  it('rejects a temperature outside the 0-2 range', () => {
    const result = LLMProviderConfigSchema.safeParse({ provider: 'openai', apiKey: 'x', model: 'gpt-4o-mini', temperature: 3 });
    expect(result.success).toBe(false);
  });

  it('rejects a blank model name', () => {
    const result = LLMProviderConfigSchema.safeParse({ provider: 'openai', apiKey: 'x', model: '' });
    expect(result.success).toBe(false);
  });
});

describe('parseLLMProviderConfig', () => {
  it('returns the parsed config for valid input', () => {
    const parsed = parseLLMProviderConfig({ provider: 'ollama', model: 'llama3' });
    expect(parsed.provider).toBe('ollama');
    expect(parsed.model).toBe('llama3');
  });

  it('throws a ZodError for invalid input', () => {
    expect(() => parseLLMProviderConfig({ provider: 'openai', model: 'gpt-4o-mini' })).toThrow();
  });
});

describe('safeParseLLMProviderConfig', () => {
  it('returns a success result without throwing for valid input', () => {
    const result = safeParseLLMProviderConfig({ provider: 'groq', apiKey: 'gsk-test', model: 'llama-3.3-70b-versatile' });
    expect(result.success).toBe(true);
  });

  it('returns a failure result without throwing for invalid input', () => {
    const result = safeParseLLMProviderConfig({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
    expect(result.success).toBe(false);
  });
});

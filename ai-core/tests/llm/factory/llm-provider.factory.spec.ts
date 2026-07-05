import { LLMProviderFactory } from '../../../src/llm/factory/llm-provider.factory';
import { OpenAIProvider } from '../../../src/llm/providers/openai/openai.provider';
import { AnthropicProvider } from '../../../src/llm/providers/anthropic/anthropic.provider';
import { GeminiProvider } from '../../../src/llm/providers/gemini/gemini.provider';
import { GroqProvider } from '../../../src/llm/providers/groq/groq.provider';
import { OpenRouterProvider } from '../../../src/llm/providers/openrouter/openrouter.provider';
import { OllamaProvider } from '../../../src/llm/providers/ollama/ollama.provider';

describe('LLMProviderFactory', () => {
  it('creates an OpenAIProvider for provider "openai"', () => {
    const provider = LLMProviderFactory.create({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o-mini' });
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.name).toBe('openai');
  });

  it('creates an AnthropicProvider for provider "anthropic"', () => {
    const provider = LLMProviderFactory.create({ provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-3-5-sonnet-latest' });
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.name).toBe('anthropic');
  });

  it('creates a GeminiProvider for provider "gemini"', () => {
    const provider = LLMProviderFactory.create({ provider: 'gemini', apiKey: 'gm-test', model: 'gemini-1.5-flash' });
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it('creates a GroqProvider for provider "groq"', () => {
    const provider = LLMProviderFactory.create({ provider: 'groq', apiKey: 'gsk-test', model: 'llama-3.3-70b-versatile' });
    expect(provider).toBeInstanceOf(GroqProvider);
  });

  it('creates an OpenRouterProvider for provider "openrouter"', () => {
    const provider = LLMProviderFactory.create({ provider: 'openrouter', apiKey: 'or-test', model: 'openai/gpt-4o-mini' });
    expect(provider).toBeInstanceOf(OpenRouterProvider);
  });

  it('creates an OllamaProvider without requiring an apiKey', () => {
    const provider = LLMProviderFactory.create({ provider: 'ollama', model: 'llama3' });
    expect(provider).toBeInstanceOf(OllamaProvider);
    expect(provider.name).toBe('ollama');
  });

  it('throws a validation error when apiKey is missing for a cloud provider', () => {
    expect(() => LLMProviderFactory.create({ provider: 'openai', model: 'gpt-4o-mini' })).toThrow();
  });

  it('throws when given an unsupported provider name', () => {
    expect(() => LLMProviderFactory.create({ provider: 'not-a-real-provider', model: 'x' })).toThrow();
  });

  it('lists all supported providers', () => {
    const providers = LLMProviderFactory.getSupportedProviders();
    expect(providers).toEqual(expect.arrayContaining(['openai', 'anthropic', 'gemini', 'groq', 'openrouter', 'ollama']));
  });

  it('allows registering a custom provider implementation and restores the original after', () => {
    class CustomProvider extends OpenAIProvider {}

    LLMProviderFactory.register('openai', CustomProvider);
    const provider = LLMProviderFactory.create({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o-mini' });
    expect(provider).toBeInstanceOf(CustomProvider);

    LLMProviderFactory.register('openai', OpenAIProvider);
    const restored = LLMProviderFactory.create({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o-mini' });
    expect(restored).toBeInstanceOf(OpenAIProvider);
  });
});

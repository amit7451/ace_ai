import type { ILLMProvider } from '../interfaces/llm-provider.interface';
import type { LLMProviderConfig, LLMProviderName } from '../types/llm-config.types';
import { LLMProviderConfigSchema } from '../schemas/llm-config.schema';
import { OpenAIProvider } from '../providers/openai/openai.provider';
import { AnthropicProvider } from '../providers/anthropic/anthropic.provider';
import { GeminiProvider } from '../providers/gemini/gemini.provider';
import { GroqProvider } from '../providers/groq/groq.provider';
import { OpenRouterProvider } from '../providers/openrouter/openrouter.provider';
import { OllamaProvider } from '../providers/ollama/ollama.provider';

type LLMProviderConstructor = new (config: LLMProviderConfig) => ILLMProvider;

/**
 * Creates ILLMProvider instances from plain configuration objects. This is
 * the single place in the codebase that knows about concrete provider
 * classes — everything else should depend only on ILLMProvider, so that
 * swapping or adding a provider is a config/registry change, never a
 * change to business logic (Principle 3: Provider Agnostic).
 */
export class LLMProviderFactory {
  private static readonly registry = new Map<LLMProviderName, LLMProviderConstructor>([
    ['openai', OpenAIProvider],
    ['anthropic', AnthropicProvider],
    ['gemini', GeminiProvider],
    ['groq', GroqProvider],
    ['openrouter', OpenRouterProvider],
    ['ollama', OllamaProvider],
  ]);

  /** Validates `rawConfig` against the Zod schema, then builds the matching provider. */
  static create(rawConfig: unknown): ILLMProvider {
    const config = LLMProviderConfigSchema.parse(rawConfig);
    const ProviderClass = this.registry.get(config.provider);

    if (!ProviderClass) {
      const supported = Array.from(this.registry.keys()).join(', ');
      throw new Error(`Unsupported LLM provider "${config.provider}". Supported providers: ${supported}.`);
    }

    return new ProviderClass(config);
  }

  /** Registers a custom or override implementation for a given provider name. */
  static register(name: LLMProviderName, providerClass: LLMProviderConstructor): void {
    this.registry.set(name, providerClass);
  }

  static getSupportedProviders(): LLMProviderName[] {
    return Array.from(this.registry.keys());
  }
}

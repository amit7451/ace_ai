import { OpenAIProvider } from '../openai/openai.provider';
import type { LLMProviderConfig } from '../../types/llm-config.types';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * OpenRouter proxies many upstream model providers behind a single
 * OpenAI-compatible Chat Completions API, so this reuses OpenAIProvider
 * wholesale. OpenRouter also recognizes optional `HTTP-Referer` and
 * `X-Title` headers for analytics/rate-limit attribution — pass them via
 * `extraHeaders` in the provider config if desired.
 */
export class OpenRouterProvider extends OpenAIProvider {
  readonly name: string = 'openrouter';

  constructor(config: LLMProviderConfig) {
    super({ ...config, baseUrl: config.baseUrl ?? DEFAULT_BASE_URL });
  }
}

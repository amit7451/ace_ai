import { OpenAIProvider } from '../openai/openai.provider';
import type { LLMProviderConfig } from '../../types/llm-config.types';

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Groq exposes an OpenAI-compatible Chat Completions API, so this provider
 * reuses OpenAIProvider's request building, response parsing, and streaming
 * wholesale — only the default base URL and provider name differ.
 */
export class GroqProvider extends OpenAIProvider {
  readonly name: string = 'groq';

  constructor(config: LLMProviderConfig) {
    super({ ...config, baseUrl: config.baseUrl ?? DEFAULT_BASE_URL });
  }
}

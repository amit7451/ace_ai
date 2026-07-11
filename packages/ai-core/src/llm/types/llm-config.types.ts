import type { LLMToolDefinition } from './llm-message.types';

export type LLMProviderName = 'openai' | 'anthropic' | 'gemini' | 'groq' | 'openrouter' | 'ollama';

export interface LLMProviderConfig {
  provider: LLMProviderName;
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  organization?: string;
  extraHeaders?: Record<string, string>;
}

export interface LLMCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  tools?: LLMToolDefinition[];
  signal?: AbortSignal;
}

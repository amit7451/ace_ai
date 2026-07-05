import type { LLMToolCall } from './llm-message.types';

export type LLMFinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | 'unknown';

export interface LLMTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage: LLMTokenUsage;
  finishReason: LLMFinishReason;
  toolCalls?: LLMToolCall[];
  raw?: unknown;
}

export interface LLMStreamChunk {
  delta: string;
  isFinal: boolean;
  usage?: LLMTokenUsage;
  finishReason?: LLMFinishReason;
}

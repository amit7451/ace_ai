import type { LLMMessage } from '../types/llm-message.types';

const AVERAGE_CHARS_PER_TOKEN = 4;
const PER_MESSAGE_OVERHEAD_TOKENS = 4;

/**
 * Cheap, provider-independent heuristic (~4 chars/token) for pre-flight
 * budget checks (e.g. "will this fit in the context window before we even
 * make the call"). This is NOT a real tokenizer and will not match a
 * provider's billed usage — always prefer `LLMResponse.usage` for anything
 * that needs to be accurate.
 */
export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / AVERAGE_CHARS_PER_TOKEN);
}

export function estimateTokensFromMessages(messages: LLMMessage[]): number {
  return messages.reduce((total, message) => {
    return total + estimateTokensFromText(message.content) + PER_MESSAGE_OVERHEAD_TOKENS;
  }, 0);
}

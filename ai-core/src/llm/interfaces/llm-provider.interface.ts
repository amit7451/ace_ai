import type { LLMMessage } from '../types/llm-message.types';
import type { LLMCompletionOptions } from '../types/llm-config.types';
import type { LLMResponse, LLMStreamChunk } from '../types/llm-response.types';

/**
 * The contract every LLM provider must satisfy. Application code should
 * depend on this interface, never on a concrete provider class, so that
 * swapping providers is a configuration change rather than a code change.
 */
export interface ILLMProvider {
  /** Stable machine-readable provider identifier, e.g. "openai". */
  readonly name: string;

  /** The specific model this provider instance is configured to call. */
  readonly model: string;

  /** Runs a single, non-streamed completion request. */
  complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMResponse>;

  /** Runs a completion request and yields incremental content deltas. */
  stream(messages: LLMMessage[], options?: LLMCompletionOptions): AsyncGenerator<LLMStreamChunk, void, unknown>;

  /** Cheap, local estimate of token usage — NOT a substitute for provider-reported usage. */
  estimateTokens(messages: LLMMessage[]): number;

  /** Lightweight reachability + credential check, used by dashboard/ops tooling. */
  healthCheck(): Promise<boolean>;
}

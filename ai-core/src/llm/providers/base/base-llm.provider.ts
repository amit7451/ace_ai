import type { ILLMProvider } from '../../interfaces/llm-provider.interface';
import type { LLMMessage } from '../../types/llm-message.types';
import type { LLMCompletionOptions, LLMProviderConfig } from '../../types/llm-config.types';
import type { LLMResponse, LLMStreamChunk } from '../../types/llm-response.types';
import { estimateTokensFromMessages } from '../../utils/token-estimator.util';
import { retryWithBackoff } from '../../utils/retry.util';
import { LLMInvalidRequestError, LLMTimeoutError } from '../../errors/llm.errors';

/**
 * Shared behaviour for every concrete LLM provider: configuration handling,
 * timeout + retry orchestration, header construction, and token estimation.
 *
 * Concrete providers only need to implement the wire format for their
 * specific API (`complete`, `stream`, `healthCheck`).
 */
export abstract class BaseLLMProvider implements ILLMProvider {
  abstract readonly name: string;
  readonly model: string;

  protected readonly config: LLMProviderConfig;
  protected readonly maxRetries: number;
  protected readonly timeoutMs: number;
  protected readonly retryBaseDelayMs: number;
  protected readonly retryMaxDelayMs: number;

  constructor(config: LLMProviderConfig) {
    if (config.provider !== 'ollama' && !config.apiKey) {
      throw new LLMInvalidRequestError(`Provider "${config.provider}" requires an apiKey.`, {
        provider: config.provider,
        model: config.model,
      });
    }

    this.config = config;
    this.model = config.model;
    this.maxRetries = config.maxRetries ?? 3;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? 500;
    this.retryMaxDelayMs = config.retryMaxDelayMs ?? 15_000;
  }

  abstract complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMResponse>;

  abstract stream(messages: LLMMessage[], options?: LLMCompletionOptions): AsyncGenerator<LLMStreamChunk, void, unknown>;

  abstract healthCheck(): Promise<boolean>;

  estimateTokens(messages: LLMMessage[]): number {
    return estimateTokensFromMessages(messages);
  }

  /**
   * Runs `fn` with a per-attempt timeout, retrying transient failures with
   * exponential backoff. Intended to wrap the *initial* network call only —
   * once a stream connection is established, chunks are consumed without an
   * additional timeout wrapper (see providers' `stream()` implementations).
   */
  protected executeWithResilience<T>(fn: () => Promise<T>): Promise<T> {
    return retryWithBackoff(() => this.withTimeout(fn()), {
      maxRetries: this.maxRetries,
      baseDelayMs: this.retryBaseDelayMs,
      maxDelayMs: this.retryMaxDelayMs,
    });
  }

  protected withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new LLMTimeoutError({ provider: this.name, model: this.model }));
      }, this.timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  protected buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.config.extraHeaders ?? {}),
      ...(extra ?? {}),
    };
  }
}

import { BaseLLMProvider } from '../base/base-llm.provider';
import type { LLMMessage } from '../../types/llm-message.types';
import type { LLMCompletionOptions, LLMProviderConfig } from '../../types/llm-config.types';
import type { LLMResponse, LLMStreamChunk } from '../../types/llm-response.types';
import { mapHttpErrorResponse, LLMInvalidRequestError, type HttpErrorLike } from '../../errors/llm.errors';
import { parseNDJSONStream } from '../../utils/stream-parser.util';

const DEFAULT_BASE_URL = 'http://localhost:11434';

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

/**
 * Ollama's native /api/chat endpoint for local model inference. No API key
 * is required — this is the provider that keeps "Local Development First"
 * true end-to-end. Streaming uses newline-delimited JSON, not SSE.
 */
export class OllamaProvider extends BaseLLMProvider {
  readonly name: string = 'ollama';
  protected readonly baseUrl: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMResponse> {
    return this.executeWithResilience(async () => {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(this.buildRequestBody(messages, options, false)),
        signal: options?.signal,
      });

      if (!response.ok) {
        throw await this.toOllamaError(response);
      }

      const data = (await response.json()) as OllamaChatResponse;

      return {
        content: data.message?.content ?? '',
        model: data.model,
        provider: this.name,
        usage: {
          promptTokens: data.prompt_eval_count ?? 0,
          completionTokens: data.eval_count ?? 0,
          totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
        },
        finishReason: 'stop',
        raw: data,
      };
    });
  }

  async *stream(messages: LLMMessage[], options?: LLMCompletionOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const response = await this.executeWithResilience(() =>
      fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(this.buildRequestBody(messages, options, true)),
        signal: options?.signal,
      })
    );

    if (!response.ok) {
      throw await this.toOllamaError(response);
    }
    if (!response.body) {
      throw new LLMInvalidRequestError('Ollama stream response had no body.', { provider: this.name, model: this.model });
    }

    const body = response.body;

    for await (const raw of parseNDJSONStream(body)) {
      const chunk = JSON.parse(raw) as OllamaChatResponse;

      yield {
        delta: chunk.message?.content ?? '',
        isFinal: chunk.done,
        finishReason: chunk.done ? 'stop' : undefined,
        usage: chunk.done
          ? {
              promptTokens: chunk.prompt_eval_count ?? 0,
              completionTokens: chunk.eval_count ?? 0,
              totalTokens: (chunk.prompt_eval_count ?? 0) + (chunk.eval_count ?? 0),
            }
          : undefined,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildRequestBody(messages: LLMMessage[], options: LLMCompletionOptions | undefined, stream: boolean) {
    return {
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream,
      options: {
        temperature: options?.temperature ?? this.config.temperature,
        num_predict: options?.maxTokens ?? this.config.maxTokens,
        stop: options?.stopSequences,
      },
    };
  }

  private async toOllamaError(response: HttpErrorLike) {
    if (response.status === 404) {
      const body = await response.text();
      return new LLMInvalidRequestError(
        `Model "${this.model}" was not found on the Ollama server. Pull it first with "ollama pull ${this.model}".`,
        { provider: this.name, model: this.model, statusCode: 404, cause: body }
      );
    }
    return mapHttpErrorResponse(response, this.name, this.model);
  }
}

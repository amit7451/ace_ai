import { BaseLLMProvider } from '../base/base-llm.provider';
import type { LLMMessage } from '../../types/llm-message.types';
import type { LLMCompletionOptions, LLMProviderConfig } from '../../types/llm-config.types';
import type { LLMFinishReason, LLMResponse, LLMStreamChunk } from '../../types/llm-response.types';
import { mapHttpErrorResponse, LLMInvalidRequestError } from '../../errors/llm.errors';
import { parseSSEStream } from '../../utils/stream-parser.util';

const DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MAX_TOKENS = 4096;

interface AnthropicMessageResponse {
  id: string;
  model: string;
  content: Array<{ type: string; text?: string }>;
  stop_reason: string | null;
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicStreamEvent {
  type: string;
  message?: { usage: { input_tokens: number; output_tokens: number } };
  delta?: { type?: string; text?: string; stop_reason?: string | null };
  usage?: { output_tokens: number };
}

/**
 * Anthropic Messages API. Note this API's shape differs from the OpenAI
 * convention in two important ways this provider has to bridge:
 *   1. `system` is a top-level field, not a message with role "system".
 *   2. `max_tokens` is a required field, not optional.
 */
export class AnthropicProvider extends BaseLLMProvider {
  readonly name: string = 'anthropic';
  protected readonly baseUrl: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMResponse> {
    return this.executeWithResilience(async () => {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.buildHeaders(this.authHeaders()),
        body: JSON.stringify(this.buildRequestBody(messages, options, false)),
        signal: options?.signal,
      });

      if (!response.ok) {
        throw await mapHttpErrorResponse(response, this.name, this.model);
      }

      const data = (await response.json()) as AnthropicMessageResponse;
      const text = data.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('');

      return {
        content: text,
        model: data.model,
        provider: this.name,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
        finishReason: this.mapFinishReason(data.stop_reason),
        raw: data,
      };
    });
  }

  async *stream(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const response = await this.executeWithResilience(async () => {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.buildHeaders(this.authHeaders()),
        body: JSON.stringify(this.buildRequestBody(messages, options, true)),
        signal: options?.signal,
      });

      if (!res.ok) {
        throw await mapHttpErrorResponse(res, this.name, this.model);
      }
      return res;
    });
    if (!response.body) {
      throw new LLMInvalidRequestError('Anthropic stream response had no body.', {
        provider: this.name,
        model: this.model,
      });
    }

    const body = response.body;
    let inputTokens = 0;

    for await (const raw of parseSSEStream(body)) {
      const event = JSON.parse(raw) as AnthropicStreamEvent;

      if (event.type === 'message_start' && event.message) {
        inputTokens = event.message.usage.input_tokens;
        continue;
      }

      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        yield { delta: event.delta.text ?? '', isFinal: false };
        continue;
      }

      if (event.type === 'message_delta' && event.usage) {
        yield {
          delta: '',
          isFinal: true,
          finishReason: this.mapFinishReason(event.delta?.stop_reason ?? null),
          usage: {
            promptTokens: inputTokens,
            completionTokens: event.usage.output_tokens,
            totalTokens: inputTokens + event.usage.output_tokens,
          },
        };
      }
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.buildHeaders(this.authHeaders()),
        body: JSON.stringify({
          model: this.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });
      return response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  }

  protected authHeaders(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey ?? '',
      'anthropic-version': ANTHROPIC_VERSION,
    };
  }

  private buildRequestBody(
    messages: LLMMessage[],
    options: LLMCompletionOptions | undefined,
    stream: boolean
  ) {
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    return {
      model: this.model,
      system: systemMessage,
      messages: conversation,
      max_tokens: options?.maxTokens ?? this.config.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: options?.temperature ?? this.config.temperature,
      stop_sequences: options?.stopSequences,
      stream,
    };
  }

  private mapFinishReason(reason: string | null): LLMFinishReason {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      default:
        return 'unknown';
    }
  }
}

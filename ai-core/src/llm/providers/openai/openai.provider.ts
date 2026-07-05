import { BaseLLMProvider } from '../base/base-llm.provider';
import type { LLMMessage, LLMToolDefinition } from '../../types/llm-message.types';
import type { LLMCompletionOptions, LLMProviderConfig } from '../../types/llm-config.types';
import type { LLMFinishReason, LLMResponse, LLMStreamChunk } from '../../types/llm-response.types';
import { mapHttpErrorResponse, LLMInvalidRequestError } from '../../errors/llm.errors';
import { parseSSEStream } from '../../utils/stream-parser.util';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

interface OpenAIChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    message: { role: string; content: string | null };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface OpenAIStreamChunkPayload {
  choices: Array<{
    delta: { content?: string };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
}

/**
 * OpenAI Chat Completions API. Also serves as the base implementation for
 * every OpenAI-compatible vendor (Groq, OpenRouter) — see those provider
 * files, which extend this class and only override the base URL and name.
 */
export class OpenAIProvider extends BaseLLMProvider {
  readonly name: string = 'openai';
  protected readonly baseUrl: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMResponse> {
    return this.executeWithResilience(async () => {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(this.authHeaders()),
        body: JSON.stringify(this.buildRequestBody(messages, options, false)),
        signal: options?.signal,
      });

      if (!response.ok) {
        throw await mapHttpErrorResponse(response, this.name, this.model);
      }

      const data = (await response.json()) as OpenAIChatCompletionResponse;
      const choice = data.choices[0];

      return {
        content: choice?.message?.content ?? '',
        model: data.model,
        provider: this.name,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        finishReason: this.mapFinishReason(choice?.finish_reason),
        raw: data,
      };
    });
  }

  async *stream(messages: LLMMessage[], options?: LLMCompletionOptions): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const response = await this.executeWithResilience(() =>
      fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(this.authHeaders()),
        body: JSON.stringify(this.buildRequestBody(messages, options, true)),
        signal: options?.signal,
      })
    );

    if (!response.ok) {
      throw await mapHttpErrorResponse(response, this.name, this.model);
    }
    if (!response.body) {
      throw new LLMInvalidRequestError('OpenAI stream response had no body.', { provider: this.name, model: this.model });
    }

    const body = response.body;

    for await (const raw of parseSSEStream(body)) {
      const payload = JSON.parse(raw) as OpenAIStreamChunkPayload;
      const choice = payload.choices[0];
      const delta = choice?.delta?.content ?? '';
      const finishReason = choice?.finish_reason;

      yield {
        delta,
        isFinal: finishReason != null,
        finishReason: finishReason ? this.mapFinishReason(finishReason) : undefined,
        usage: payload.usage
          ? {
              promptTokens: payload.usage.prompt_tokens,
              completionTokens: payload.usage.completion_tokens,
              totalTokens: payload.usage.total_tokens,
            }
          : undefined,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, { headers: this.buildHeaders(this.authHeaders()) });
      return response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  }

  protected authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.config.apiKey ?? ''}` };
    if (this.config.organization) {
      headers['OpenAI-Organization'] = this.config.organization;
    }
    return headers;
  }

  private buildRequestBody(messages: LLMMessage[], options: LLMCompletionOptions | undefined, stream: boolean) {
    return {
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content, name: m.name })),
      temperature: options?.temperature ?? this.config.temperature,
      max_tokens: options?.maxTokens ?? this.config.maxTokens,
      stop: options?.stopSequences,
      stream,
      tools: this.mapTools(options?.tools),
    };
  }

  private mapTools(tools?: LLMToolDefinition[]) {
    if (!tools || tools.length === 0) return undefined;
    return tools.map((tool) => ({
      type: 'function',
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }));
  }

  private mapFinishReason(reason: string | null | undefined): LLMFinishReason {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'unknown';
    }
  }
}

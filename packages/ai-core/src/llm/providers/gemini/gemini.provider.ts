import { BaseLLMProvider } from '../base/base-llm.provider';
import type { LLMMessage } from '../../types/llm-message.types';
import type { LLMCompletionOptions, LLMProviderConfig } from '../../types/llm-config.types';
import type { LLMFinishReason, LLMResponse, LLMStreamChunk } from '../../types/llm-response.types';
import { mapHttpErrorResponse, LLMInvalidRequestError } from '../../errors/llm.errors';
import { parseSSEStream } from '../../utils/stream-parser.util';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiGenerateContentResponse {
  candidates: Array<{
    content: { parts: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Google Gemini generateContent / streamGenerateContent API. Bridges two
 * shape differences from the OpenAI convention:
 *   1. Roles are "user" / "model", not "user" / "assistant".
 *   2. The system prompt is a separate `systemInstruction` field.
 * Uses the `x-goog-api-key` header rather than the `?key=` query param so
 * the key never ends up in server access logs.
 */
export class GeminiProvider extends BaseLLMProvider {
  readonly name: string = 'gemini';
  protected readonly baseUrl: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMResponse> {
    return this.executeWithResilience(async () => {
      const response = await fetch(this.buildUrl('generateContent'), {
        method: 'POST',
        headers: this.buildHeaders(this.authHeaders()),
        body: JSON.stringify(this.buildRequestBody(messages, options)),
        signal: options?.signal,
      });

      if (!response.ok) {
        throw await mapHttpErrorResponse(response, this.name, this.model);
      }

      const data = (await response.json()) as GeminiGenerateContentResponse;
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

      return {
        content: text,
        model: this.model,
        provider: this.name,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
          totalTokens: data.usageMetadata?.totalTokenCount ?? 0,
        },
        finishReason: this.mapFinishReason(candidate?.finishReason),
        raw: data,
      };
    });
  }

  async *stream(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const response = await this.executeWithResilience(() =>
      fetch(this.buildUrl('streamGenerateContent'), {
        method: 'POST',
        headers: this.buildHeaders(this.authHeaders()),
        body: JSON.stringify(this.buildRequestBody(messages, options)),
        signal: options?.signal,
      })
    );

    if (!response.ok) {
      throw await mapHttpErrorResponse(response, this.name, this.model);
    }
    if (!response.body) {
      throw new LLMInvalidRequestError('Gemini stream response had no body.', {
        provider: this.name,
        model: this.model,
      });
    }

    const body = response.body;

    for await (const raw of parseSSEStream(body)) {
      const payload = JSON.parse(raw) as GeminiGenerateContentResponse;
      const candidate = payload.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
      const finishReason = candidate?.finishReason;

      yield {
        delta: text,
        isFinal: Boolean(finishReason),
        finishReason: finishReason ? this.mapFinishReason(finishReason) : undefined,
        usage: payload.usageMetadata
          ? {
              promptTokens: payload.usageMetadata.promptTokenCount,
              completionTokens: payload.usageMetadata.candidatesTokenCount,
              totalTokens: payload.usageMetadata.totalTokenCount,
            }
          : undefined,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models/${this.model}`, {
        headers: this.buildHeaders(this.authHeaders()),
      });
      return response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  }

  protected authHeaders(): Record<string, string> {
    return { 'x-goog-api-key': this.config.apiKey ?? '' };
  }

  private buildUrl(action: 'generateContent' | 'streamGenerateContent'): string {
    const streamSuffix = action === 'streamGenerateContent' ? '?alt=sse' : '';
    return `${this.baseUrl}/models/${this.model}:${action}${streamSuffix}`;
  }

  private buildRequestBody(messages: LLMMessage[], options?: LLMCompletionOptions) {
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    return {
      contents,
      systemInstruction: systemMessage ? { parts: [{ text: systemMessage }] } : undefined,
      generationConfig: {
        temperature: options?.temperature ?? this.config.temperature,
        maxOutputTokens: options?.maxTokens ?? this.config.maxTokens,
        stopSequences: options?.stopSequences,
      },
    };
  }

  private mapFinishReason(reason?: string): LLMFinishReason {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
      case 'RECITATION':
        return 'content_filter';
      default:
        return 'unknown';
    }
  }
}

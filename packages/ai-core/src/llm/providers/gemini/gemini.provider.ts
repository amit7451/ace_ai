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

interface GeminiModelInfo {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

interface GeminiListModelsResponse {
  models?: GeminiModelInfo[];
}

// In-memory cache for available Gemini models per apiKey/baseUrl
const modelCache = new Map<string, { models: string[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Google Gemini generateContent / streamGenerateContent API with dynamic model
 * availability discovery and self-healing fallback resolution.
 */
export class GeminiProvider extends BaseLLMProvider {
  readonly name: string = 'gemini';
  protected readonly baseUrl: string;
  private resolvedModel?: string;

  constructor(config: LLMProviderConfig) {
    super(config);
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  }

  /**
   * Discovers the models available for the configured API key from Google Generative Language API.
   */
  async listAvailableModels(): Promise<string[]> {
    const apiKey = this.config.apiKey ?? '';
    const cacheKey = `${this.baseUrl}:${apiKey}`;
    const cached = modelCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.models;
    }

    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: this.buildHeaders(this.authHeaders()),
      });
      if (res.ok) {
        const data = (await res.json()) as GeminiListModelsResponse;
        const generationModels = (data.models || [])
          .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
          .map((m) => m.name.replace(/^models\//, ''));

        if (generationModels.length > 0) {
          modelCache.set(cacheKey, { models: generationModels, timestamp: Date.now() });
          return generationModels;
        }
      }
    } catch {
      // Fall back if listing network call fails
    }

    return cached?.models ?? [];
  }

  /**
   * Matches a preferred model name against dynamically available generation models.
   */
  async resolveActiveModel(preferredModel: string): Promise<string> {
    const cleanPreferred = preferredModel.replace(/^models\//, '');
    const available = await this.listAvailableModels();
    if (available.length === 0) {
      return cleanPreferred;
    }

    // 1. Exact match
    if (available.includes(cleanPreferred)) {
      return cleanPreferred;
    }

    // 2. Suffix / variation match (e.g. -latest, -001, -002, -preview)
    const exactPrefixMatch = available.find(
      (m) => m === `${cleanPreferred}-latest` || m.startsWith(`${cleanPreferred}-`)
    );
    if (exactPrefixMatch) {
      return exactPrefixMatch;
    }

    // 3. Family / capability intent match (e.g. 'flash', 'pro')
    if (cleanPreferred.includes('flash')) {
      const flashModel =
        available.find((m) => m.includes('2.0-flash')) ||
        available.find((m) => m.includes('1.5-flash')) ||
        available.find((m) => m.includes('flash'));
      if (flashModel) return flashModel;
    }

    if (cleanPreferred.includes('pro')) {
      const proModel =
        available.find((m) => m.includes('1.5-pro')) ||
        available.find((m) => m.includes('2.0-pro')) ||
        available.find((m) => m.includes('pro'));
      if (proModel) return proModel;
    }

    // 4. Default to the highest priority available generation model
    return available[0] || cleanPreferred;
  }

  private isModelNotFoundError(err: any): boolean {
    const msg = String(err?.message || '').toLowerCase();
    return (
      err?.statusCode === 404 ||
      msg.includes('not found') ||
      msg.includes('modelservice.listmodels') ||
      msg.includes('not supported for generatecontent')
    );
  }

  private async executeComplete(
    targetModel: string,
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): Promise<LLMResponse> {
    return this.executeWithResilience(async () => {
      const response = await fetch(this.buildUrl(targetModel, 'generateContent'), {
        method: 'POST',
        headers: this.buildHeaders(this.authHeaders()),
        body: JSON.stringify(this.buildRequestBody(messages, options)),
        signal: options?.signal,
      });

      if (!response.ok) {
        throw await mapHttpErrorResponse(response, this.name, targetModel);
      }

      const data = (await response.json()) as GeminiGenerateContentResponse;
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

      return {
        content: text,
        model: targetModel,
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

  async complete(messages: LLMMessage[], options?: LLMCompletionOptions): Promise<LLMResponse> {
    let targetModel =
      this.resolvedModel || (this.model ? this.model.replace(/^models\//, '') : 'gemini-1.5-flash');

    try {
      return await this.executeComplete(targetModel, messages, options);
    } catch (err: any) {
      if (this.isModelNotFoundError(err)) {
        const apiKey = this.config.apiKey ?? '';
        modelCache.delete(`${this.baseUrl}:${apiKey}`);
        const fallbackModel = await this.resolveActiveModel(targetModel);
        if (fallbackModel !== targetModel) {
          this.resolvedModel = fallbackModel;
          return await this.executeComplete(fallbackModel, messages, options);
        }
      }
      throw err;
    }
  }

  async *stream(
    messages: LLMMessage[],
    options?: LLMCompletionOptions
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    let targetModel =
      this.resolvedModel || (this.model ? this.model.replace(/^models\//, '') : 'gemini-1.5-flash');
    let response: Response;

    try {
      response = await this.executeWithResilience(async () => {
        const res = await fetch(this.buildUrl(targetModel, 'streamGenerateContent'), {
          method: 'POST',
          headers: this.buildHeaders(this.authHeaders()),
          body: JSON.stringify(this.buildRequestBody(messages, options)),
          signal: options?.signal,
        });

        if (!res.ok) {
          throw await mapHttpErrorResponse(res, this.name, targetModel);
        }
        return res;
      });
    } catch (err: any) {
      if (this.isModelNotFoundError(err)) {
        const apiKey = this.config.apiKey ?? '';
        modelCache.delete(`${this.baseUrl}:${apiKey}`);
        const fallbackModel = await this.resolveActiveModel(targetModel);
        if (fallbackModel !== targetModel) {
          this.resolvedModel = fallbackModel;
          targetModel = fallbackModel;
          response = await this.executeWithResilience(async () => {
            const res = await fetch(this.buildUrl(fallbackModel, 'streamGenerateContent'), {
              method: 'POST',
              headers: this.buildHeaders(this.authHeaders()),
              body: JSON.stringify(this.buildRequestBody(messages, options)),
              signal: options?.signal,
            });

            if (!res.ok) {
              throw await mapHttpErrorResponse(res, this.name, fallbackModel);
            }
            return res;
          });
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }

    if (!response.body) {
      throw new LLMInvalidRequestError('Gemini stream response had no body.', {
        provider: this.name,
        model: targetModel,
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
      const targetModel = this.resolvedModel || this.model.replace(/^models\//, '');
      const response = await fetch(`${this.baseUrl}/models/${targetModel}`, {
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

  private buildUrl(model: string, action: 'generateContent' | 'streamGenerateContent'): string {
    const cleanModel = model.replace(/^models\//, '');
    const streamSuffix = action === 'streamGenerateContent' ? '?alt=sse' : '';
    return `${this.baseUrl}/models/${cleanModel}:${action}${streamSuffix}`;
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

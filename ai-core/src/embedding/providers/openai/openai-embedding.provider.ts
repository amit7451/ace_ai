import { EmbeddingConfig, EmbeddingInputType } from '../../types/embedding-config.types';
import { EmbeddingResponse } from '../../types/embedding-response.types';
import { BaseEmbeddingProvider } from '../base/base-embedding.provider';
import { mapHttpStatusToEmbeddingError } from '../../errors/error-mapper';

const KNOWN_DIMENSIONS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
};

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

interface OpenAIEmbeddingApiResponse {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

export class OpenAIEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'openai' as const;
  // OpenAI's API allows up to 2048 inputs per request; kept conservative here
  // for predictable request latency and to bound single-request payload size.
  // Raise via `maxBatchSize` in config if your workload benefits from larger calls.
  protected readonly vendorMaxBatchSize = 512;

  constructor(config: EmbeddingConfig) {
    super(config, KNOWN_DIMENSIONS[config.model] ?? 1536);
  }

  protected async rawEmbed(inputs: string[], _inputType: EmbeddingInputType): Promise<EmbeddingResponse> {
    const url = `${this.config.baseUrl ?? DEFAULT_BASE_URL}/embeddings`;

    const body: Record<string, unknown> = {
      model: this.model,
      input: inputs,
    };
    // Only the text-embedding-3-* family supports output truncation via "dimensions".
    if (this.config.dimensions && this.model.startsWith('text-embedding-3')) {
      body.dimensions = this.config.dimensions;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
      throw mapHttpStatusToEmbeddingError(this.name, response.status, text, retryAfterMs);
    }

    const json = (await response.json()) as OpenAIEmbeddingApiResponse;

    return {
      embeddings: json.data.map((d) => ({ embedding: d.embedding, index: d.index })),
      model: json.model,
      dimensions: json.data[0]?.embedding.length ?? this.dimensions,
      usage: {
        promptTokens: json.usage.prompt_tokens,
        totalTokens: json.usage.total_tokens,
      },
    };
  }
}

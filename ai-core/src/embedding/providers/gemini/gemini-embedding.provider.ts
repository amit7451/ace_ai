import { EmbeddingConfig, EmbeddingInputType } from '../../types/embedding-config.types';
import { EmbeddingResponse } from '../../types/embedding-response.types';
import { BaseEmbeddingProvider } from '../base/base-embedding.provider';
import { mapHttpStatusToEmbeddingError } from '../../errors/error-mapper';
import { estimateTokens } from '../../utils/token-estimation';

const KNOWN_DIMENSIONS: Record<string, number> = {
  'text-embedding-004': 768,
  'gemini-embedding-001': 3072,
};

const TASK_TYPE_MAP: Record<EmbeddingInputType, string> = {
  document: 'RETRIEVAL_DOCUMENT',
  query: 'RETRIEVAL_QUERY',
  clustering: 'CLUSTERING',
  classification: 'CLASSIFICATION',
};

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiBatchEmbedResponse {
  embeddings: { values: number[] }[];
}

export class GeminiEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'gemini' as const;
  // batchEmbedContents accepts up to 100 requests per call.
  protected readonly vendorMaxBatchSize = 100;

  constructor(config: EmbeddingConfig) {
    super(config, KNOWN_DIMENSIONS[config.model] ?? 768);
  }

  protected async rawEmbed(inputs: string[], inputType: EmbeddingInputType): Promise<EmbeddingResponse> {
    const baseUrl = this.config.baseUrl ?? DEFAULT_BASE_URL;
    const url = `${baseUrl}/models/${this.model}:batchEmbedContents?key=${this.config.apiKey}`;
    const taskType = TASK_TYPE_MAP[inputType] ?? TASK_TYPE_MAP.document;

    const body = {
      requests: inputs.map((text) => ({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
        taskType,
        ...(this.config.dimensions ? { outputDimensionality: this.config.dimensions } : {}),
      })),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw mapHttpStatusToEmbeddingError(this.name, response.status, text);
    }

    const json = (await response.json()) as GeminiBatchEmbedResponse;

    // Gemini's embedding endpoints don't return token usage, unlike its chat completion
    // endpoint — fall back to the shared character-based heuristic (see utils/token-estimation).
    const promptTokens = inputs.reduce((sum, t) => sum + estimateTokens(t), 0);

    return {
      embeddings: json.embeddings.map((e, index) => ({ embedding: e.values, index })),
      model: this.model,
      dimensions: json.embeddings[0]?.values.length ?? this.dimensions,
      usage: { promptTokens, totalTokens: promptTokens },
    };
  }
}

import { EmbeddingConfig, EmbeddingInputType } from '../../types/embedding-config.types';
import { EmbeddingResponse } from '../../types/embedding-response.types';
import { BaseEmbeddingProvider } from '../base/base-embedding.provider';
import { mapHttpStatusToEmbeddingError } from '../../errors/error-mapper';
import { estimateTokens } from '../../utils/token-estimation';

const KNOWN_DIMENSIONS: Record<string, number> = {
  'embed-english-v3.0': 1024,
  'embed-multilingual-v3.0': 1024,
  'embed-english-light-v3.0': 384,
  'embed-multilingual-light-v3.0': 384,
};

const INPUT_TYPE_MAP: Record<EmbeddingInputType, string> = {
  document: 'search_document',
  query: 'search_query',
  clustering: 'clustering',
  classification: 'classification',
};

const DEFAULT_BASE_URL = 'https://api.cohere.com/v1';

interface CohereEmbedResponse {
  embeddings: { float: number[][] } | number[][];
  meta?: { billed_units?: { input_tokens?: number } };
}

export class CohereEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'cohere' as const;
  // Cohere's /embed endpoint caps `texts` at 96 entries per request.
  protected readonly vendorMaxBatchSize = 96;

  constructor(config: EmbeddingConfig) {
    super(config, KNOWN_DIMENSIONS[config.model] ?? 1024);
  }

  protected async rawEmbed(inputs: string[], inputType: EmbeddingInputType): Promise<EmbeddingResponse> {
    const url = `${this.config.baseUrl ?? DEFAULT_BASE_URL}/embed`;

    const body = {
      model: this.model,
      texts: inputs,
      input_type: INPUT_TYPE_MAP[inputType] ?? INPUT_TYPE_MAP.document,
      embedding_types: ['float'],
    };

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
      throw mapHttpStatusToEmbeddingError(this.name, response.status, text);
    }

    const json = (await response.json()) as CohereEmbedResponse;
    const vectors = Array.isArray(json.embeddings) ? json.embeddings : json.embeddings.float;
    const promptTokens = json.meta?.billed_units?.input_tokens ?? inputs.reduce((sum, t) => sum + estimateTokens(t), 0);

    return {
      embeddings: vectors.map((embedding, index) => ({ embedding, index })),
      model: this.model,
      dimensions: vectors[0]?.length ?? this.dimensions,
      usage: { promptTokens, totalTokens: promptTokens },
    };
  }
}

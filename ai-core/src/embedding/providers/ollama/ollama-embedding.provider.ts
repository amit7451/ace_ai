import { EmbeddingConfig, EmbeddingInputType } from '../../types/embedding-config.types';
import { EmbeddingResponse } from '../../types/embedding-response.types';
import { BaseEmbeddingProvider } from '../base/base-embedding.provider';
import { mapHttpStatusToEmbeddingError } from '../../errors/error-mapper';
import { estimateTokens } from '../../utils/token-estimation';

// Covers the models referenced in the platform's tech stack (BAAI BGE, Nomic
// Embed, E5-family) as they're published under Ollama's library.
const KNOWN_DIMENSIONS: Record<string, number> = {
  'nomic-embed-text': 768,
  'mxbai-embed-large': 1024,
  'bge-m3': 1024,
  'bge-large': 1024,
  'all-minilm': 384,
};

const DEFAULT_BASE_URL = 'http://localhost:11434';

interface OllamaEmbedResponse {
  embeddings: number[][];
  prompt_eval_count?: number;
}

/**
 * No API key required — the "local development first" provider. Talks to a
 * local (or self-hosted) Ollama server, so the whole embedding layer works
 * fully offline, same as the `ollama` provider in the LLM Provider Layer.
 */
export class OllamaEmbeddingProvider extends BaseEmbeddingProvider {
  readonly name = 'ollama' as const;
  // Local inference is typically serialized on a single GPU/CPU, so large
  // batches mostly add latency rather than saving round trips — kept small
  // and safe by default; raise via `maxBatchSize` if your hardware allows it.
  protected readonly vendorMaxBatchSize = 50;

  constructor(config: EmbeddingConfig) {
    super(config, KNOWN_DIMENSIONS[config.model] ?? 768);
  }

  protected async rawEmbed(inputs: string[], _inputType: EmbeddingInputType): Promise<EmbeddingResponse> {
    const url = `${this.config.baseUrl ?? DEFAULT_BASE_URL}/api/embed`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: inputs }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw mapHttpStatusToEmbeddingError(this.name, response.status, text);
    }

    const json = (await response.json()) as OllamaEmbedResponse;
    const promptTokens = json.prompt_eval_count ?? inputs.reduce((sum, t) => sum + estimateTokens(t), 0);

    return {
      embeddings: json.embeddings.map((embedding, index) => ({ embedding, index })),
      model: this.model,
      dimensions: json.embeddings[0]?.length ?? this.dimensions,
      usage: { promptTokens, totalTokens: promptTokens },
    };
  }

  /** A lightweight /api/tags ping is a more honest liveness signal than forcing a real embed call with no API key gate. */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl ?? DEFAULT_BASE_URL}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

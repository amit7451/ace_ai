import {
  EmbeddingConfig,
  EmbeddingInputType,
  EmbeddingProviderName,
  ResolvedEmbeddingConfig,
} from '../../types/embedding-config.types';
import { EmbedOptions } from '../../types/embedding-request.types';
import { EmbeddingResponse, EmbeddingVector } from '../../types/embedding-response.types';
import { IEmbeddingProvider } from '../../interfaces/embedding-provider.interface';
import { chunkArray } from '../../utils/batching';
import { retryWithBackoff } from '../../utils/retry';
import { isRetryableEmbeddingError } from '../../errors/error-mapper';
import {
  EmbeddingDimensionMismatchError,
  EmbeddingInvalidRequestError,
  EmbeddingTimeoutError,
} from '../../errors/embedding.errors';

/**
 * Shared retry/timeout/batching/header logic for every embedding vendor —
 * mirrors `BaseLLMProvider` from the LLM Provider Layer. Concrete providers
 * only implement `rawEmbed()`, a single vendor HTTP call for a batch that is
 * already guaranteed to respect that vendor's max batch size.
 */
export abstract class BaseEmbeddingProvider implements IEmbeddingProvider {
  abstract readonly name: EmbeddingProviderName;
  readonly model: string;
  readonly dimensions: number;

  protected readonly config: ResolvedEmbeddingConfig;

  /** Vendor's hard limit on inputs-per-request. `config.maxBatchSize` can only lower this, never raise it. */
  protected abstract readonly vendorMaxBatchSize: number;

  constructor(config: EmbeddingConfig, defaultDimensions: number) {
    this.model = config.model;
    this.dimensions = config.dimensions ?? defaultDimensions;
    this.config = {
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      dimensions: config.dimensions,
      maxRetries: config.maxRetries ?? 3,
      timeoutMs: config.timeoutMs ?? 30_000,
      maxBatchSize: config.maxBatchSize,
      defaultInputType: config.defaultInputType ?? 'document',
    };
  }

  protected get effectiveMaxBatchSize(): number {
    if (!this.config.maxBatchSize) return this.vendorMaxBatchSize;
    return Math.min(this.config.maxBatchSize, this.vendorMaxBatchSize);
  }

  async embed(input: string, options?: EmbedOptions): Promise<EmbeddingResponse> {
    return this.embedBatch([input], options);
  }

  async embedBatch(inputs: string[], options?: EmbedOptions): Promise<EmbeddingResponse> {
    if (!inputs || inputs.length === 0) {
      throw new EmbeddingInvalidRequestError('"inputs" must be a non-empty array.', this.name);
    }
    if (inputs.some((i) => typeof i !== 'string' || i.length === 0)) {
      throw new EmbeddingInvalidRequestError('Every input must be a non-empty string.', this.name);
    }

    const inputType: EmbeddingInputType = options?.inputType ?? this.config.defaultInputType;
    const batches = chunkArray(inputs, this.effectiveMaxBatchSize);

    const embeddings: EmbeddingVector[] = [];
    let promptTokens = 0;
    let totalTokens = 0;
    let indexOffset = 0;

    for (const batch of batches) {
      const result = await retryWithBackoff(
        () => this.executeWithTimeout(() => this.rawEmbed(batch, inputType)),
        {
          maxRetries: this.config.maxRetries,
          isRetryable: isRetryableEmbeddingError,
        }
      );

      for (const vec of result.embeddings) {
        this.assertDimensions(vec.embedding.length);
        embeddings.push({ embedding: vec.embedding, index: indexOffset + vec.index });
      }
      indexOffset += batch.length;
      promptTokens += result.usage.promptTokens;
      totalTokens += result.usage.totalTokens;
    }

    return {
      embeddings,
      model: this.model,
      dimensions: this.dimensions,
      usage: { promptTokens, totalTokens },
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.embed('healthcheck');
      return true;
    } catch {
      return false;
    }
  }

  protected assertDimensions(received: number): void {
    if (received !== this.dimensions) {
      throw new EmbeddingDimensionMismatchError(this.name, this.dimensions, received, this.model);
    }
  }

  protected async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    let timeoutHandle!: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new EmbeddingTimeoutError(this.name, this.config.timeoutMs));
      }, this.config.timeoutMs);
    });

    try {
      return await Promise.race([fn(), timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  /** Vendor-specific single-batch call. `inputs.length` is guaranteed <= effectiveMaxBatchSize. */
  protected abstract rawEmbed(
    inputs: string[],
    inputType: EmbeddingInputType
  ): Promise<EmbeddingResponse>;
}

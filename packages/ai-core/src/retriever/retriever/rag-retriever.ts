import type { IEmbeddingProvider } from '../../embedding/interfaces/embedding-provider.interface';
import type { IVectorStore } from '../../vector-store/interfaces/vector-store.interface';
import type { KnowledgeVectorPayload } from '../../vector-store/types/vector-record.types';
import type { VectorSearchResult } from '../../vector-store/types/search.types';
import type { DistanceMetric } from '../../vector-store/types/vector-store-config.types';
import type { IRetriever } from '../interfaces/retriever.interface';
import type { IRerankStrategy } from '../interfaces/rerank-strategy.interface';
import type { RetrievalQuery } from '../types/retrieval-query.types';
import type { RetrievalResult, RetrievedChunk } from '../types/retrieval-result.types';
import type { RetrieverConfig, ResolvedRetrieverConfig } from '../types/retriever-config.types';
import { retrieverConfigSchema, retrievalQuerySchema } from '../schemas/retriever-config.schema';
import { RerankStrategyFactory } from '../factory/rerank-strategy.factory';
import { buildTenantFilter } from '../utils/tenant-filter';
import { deduplicateByText } from '../utils/deduplication';
import { trimToTokenBudget } from '../utils/token-budget';
import { RetrieverDimensionMismatchError } from '../errors/retriever.errors';

/**
 * How many extra candidates to over-fetch beyond the caller's requested
 * `topK`, so threshold filtering / reranking / dedup have real headroom
 * to work with instead of operating on an already-truncated list.
 */
const SEARCH_OVER_FETCH_MULTIPLIER = 3;
const SEARCH_OVER_FETCH_MINIMUM = 10;

const DEFAULT_DISTANCE_METRIC: DistanceMetric = 'cosine';

/**
 * The façade most callers use: embed the query, search the vector store
 * with tenant isolation always applied, rerank, deduplicate, and
 * optionally trim to a token budget — implementing the architecture doc's
 * Principle 1 (Retrieval First): `Knowledge → Retrieval → Prompt → LLM →
 * Response`.
 *
 * Depends only on `IEmbeddingProvider` (Component 2) and `IVectorStore`
 * (Component 3) — never on a concrete vendor from either layer — so
 * swapping the embedding model or vector database underneath a retriever
 * already in use is a constructor-argument change, not a rewrite here.
 */
export class RagRetriever implements IRetriever {
  private readonly config: ResolvedRetrieverConfig;
  private readonly strategy: IRerankStrategy;
  private dimensionsVerified = false;
  private distanceMetric: DistanceMetric = DEFAULT_DISTANCE_METRIC;

  constructor(
    private readonly embeddingProvider: IEmbeddingProvider,
    private readonly vectorStore: IVectorStore,
    config: RetrieverConfig,
    rerankStrategy?: IRerankStrategy
  ) {
    this.config = retrieverConfigSchema.parse(config);
    this.strategy = rerankStrategy ?? RerankStrategyFactory.create(this.config.strategy);
  }

  async retrieve(rawQuery: RetrievalQuery): Promise<RetrievalResult> {
    const start = Date.now();
    const query = retrievalQuerySchema.parse(rawQuery);

    try {
      await this.ensureDimensionsVerified();

      const embedResult = await this.embeddingProvider.embed(query.query, { inputType: 'query' });
      const queryVector = embedResult.embeddings[0].embedding;

      const topK = query.topK ?? this.config.topK;
      const scoreThreshold = query.scoreThreshold ?? this.config.scoreThreshold;
      const maxContextTokens = query.maxContextTokens ?? this.config.maxContextTokens;
      const filter = buildTenantFilter(query.tenantId, query.assistantId, query.filter);
      const searchTopK = Math.max(
        topK * SEARCH_OVER_FETCH_MULTIPLIER,
        topK + SEARCH_OVER_FETCH_MINIMUM
      );

      const candidates = await this.vectorStore.search<KnowledgeVectorPayload>(
        this.config.collection,
        {
          vector: queryVector,
          topK: searchTopK,
          filter,
          withPayload: true,
          withVector: this.strategy.requiresVectors,
        }
      );

      const reranked = this.strategy.rerank(candidates, {
        queryVector,
        scoreThreshold,
        topK,
        mmrLambda: this.config.mmrLambda,
        distanceMetric: this.distanceMetric,
      });

      const deduped = deduplicateByText(reranked);
      const finalResults = maxContextTokens
        ? trimToTokenBudget(deduped, maxContextTokens)
        : deduped;
      const chunks: RetrievedChunk[] = finalResults.map((result) => this.toRetrievedChunk(result));

      return {
        query: query.query,
        chunks,
        isRelevant: chunks.length > 0,
        totalCandidates: candidates.length,
        tookMs: Date.now() - start,
      };
    } catch (err: any) {
      if (err.name === 'VectorStoreNotFoundError') {
        return {
          query: query.query,
          chunks: [],
          isRelevant: false,
          totalCandidates: 0,
          tookMs: Date.now() - start,
        };
      }
      throw err;
    }
  }

  /** Never throws — returns `false` on any embedding or vector store failure, same contract as `IVectorStore.healthCheck()`. */
  async healthCheck(): Promise<boolean> {
    const [embeddingOk, vectorStoreOk] = await Promise.all([
      this.embeddingProvider.healthCheck().catch(() => false),
      this.vectorStore.healthCheck().catch(() => false),
    ]);
    return embeddingOk && vectorStoreOk;
  }

  /**
   * Runs on every `retrieve()` call until it succeeds once, then is
   * cached for the lifetime of this instance — same lazy pattern
   * Component 3's own dimension cache uses. Deliberately does NOT cache a
   * *failed* check: a dimension mismatch is something an operator can fix
   * by re-indexing the collection while a long-lived server process is
   * still running, and this retriever should notice that the moment it
   * happens rather than staying permanently broken until restart.
   */
  private async ensureDimensionsVerified(): Promise<void> {
    if (this.dimensionsVerified) return;

    const info = await this.vectorStore.getCollectionInfo(this.config.collection);

    if (info.vectorSize !== this.embeddingProvider.dimensions) {
      throw new RetrieverDimensionMismatchError(
        this.config.collection,
        info.vectorSize,
        this.embeddingProvider.dimensions,
        this.embeddingProvider.model
      );
    }

    this.distanceMetric = info.distance;
    this.dimensionsVerified = true;
  }

  private toRetrievedChunk(result: VectorSearchResult<KnowledgeVectorPayload>): RetrievedChunk {
    const payload = result.payload;
    return {
      chunkId: payload?.chunkId ?? String(result.id),
      documentId: payload?.documentId ?? '',
      text: payload?.text ?? '',
      score: result.score,
      sourceType: payload?.sourceType ?? 'document',
      sourceUrl: payload?.sourceUrl,
      chunkIndex: payload?.chunkIndex ?? 0,
      metadata: (payload?.metadata as Record<string, unknown> | undefined) ?? undefined,
    };
  }
}

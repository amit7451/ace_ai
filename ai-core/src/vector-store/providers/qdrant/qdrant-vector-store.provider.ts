import { BaseVectorStoreProvider } from '../base/base-vector-store.provider';
import { DistanceMetric, VectorStoreConfig } from '../../types/vector-store-config.types';
import { CollectionInfo, CollectionStatus, CreateCollectionConfig } from '../../types/collection.types';
import { DeleteResult, UpsertResult, VectorId, VectorRecord } from '../../types/vector-record.types';
import { VectorFilter, VectorSearchQuery, VectorSearchResult } from '../../types/search.types';
import { VectorStoreConnectionError, VectorStoreNotFoundError } from '../../errors/vector-store.errors';
import { mapHttpStatusToError } from '../../errors/status-map';
import { toQdrantFilter } from './qdrant-filter.mapper';
import {
  QdrantCollectionInfoResponse,
  QdrantCountResponse,
  QdrantPoint,
  QdrantRetrieveResponse,
  QdrantSearchResponse,
  QdrantUpsertResponse,
  QdrantVectorParams,
} from './qdrant.types';

const DISTANCE_TO_QDRANT: Record<DistanceMetric, QdrantVectorParams['distance']> = {
  cosine: 'Cosine',
  euclid: 'Euclid',
  dot: 'Dot',
  manhattan: 'Manhattan',
};

const DISTANCE_FROM_QDRANT: Record<QdrantVectorParams['distance'], DistanceMetric> = {
  Cosine: 'cosine',
  Euclid: 'euclid',
  Dot: 'dot',
  Manhattan: 'manhattan',
};

/**
 * Qdrant implementation of `IVectorStore`, talking to Qdrant's REST API
 * directly over `fetch` — no `@qdrant/js-client-rest` dependency, same
 * "implement the vendor's HTTP API ourselves" approach Components 1 and 2
 * use for their providers. This keeps tests mockable via `global.fetch`
 * with zero extra dependencies, and keeps this package's only real
 * dependency (zod) unchanged from Component 2.
 */
export class QdrantVectorStoreProvider extends BaseVectorStoreProvider {
  readonly provider = 'qdrant' as const;

  /**
   * Conservative default: large enough to keep round trips efficient for
   * typical chunk-embedding workloads, small enough to keep a single
   * request's latency and payload size predictable. Qdrant itself has no
   * hard batch-size ceiling — raise this via `maxBatchSize` in config if
   * your workload benefits from fewer, larger requests.
   */
  protected vendorMaxBatchSize = 200;

  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: VectorStoreConfig) {
    super(config);
    this.baseUrl = config.url.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'api-key': this.apiKey } : {}),
          ...(init?.headers ?? {}),
        },
      });
    } catch (cause) {
      throw new VectorStoreConnectionError(`Could not reach Qdrant at ${this.baseUrl}. Is it running?`, {
        provider: this.provider,
        cause,
      });
    }

    if (!response.ok) {
      const body = await this.safeReadBody(response);
      const message = this.extractErrorMessage(body, response.status);
      throw mapHttpStatusToError(response.status, message, this.provider, body);
    }

    return (await response.json()) as T;
  }

  private async safeReadBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return response.text().catch(() => undefined);
    }
  }

  private extractErrorMessage(body: unknown, status: number): string {
    if (body && typeof body === 'object' && 'status' in body) {
      const statusField = (body as { status: unknown }).status;
      if (typeof statusField === 'string') return statusField;
      if (statusField && typeof statusField === 'object' && 'error' in statusField) {
        const err = (statusField as { error: unknown }).error;
        if (typeof err === 'string') return err;
      }
    }
    return `Qdrant request failed with status ${status}`;
  }

  protected async rawCreateCollection(config: CreateCollectionConfig): Promise<CollectionInfo> {
    if (config.recreateIfExists) {
      await this.rawDeleteCollection(config.name).catch(() => undefined);
    }

    await this.request(`/collections/${encodeURIComponent(config.name)}`, {
      method: 'PUT',
      body: JSON.stringify({
        vectors: {
          size: config.vectorSize,
          distance: DISTANCE_TO_QDRANT[config.distance ?? 'cosine'],
        },
        on_disk_payload: config.onDiskPayload ?? false,
      }),
    });

    return this.rawGetCollectionInfo(config.name);
  }

  protected async rawGetCollectionInfo(name: string): Promise<CollectionInfo> {
    const response = await this.request<QdrantCollectionInfoResponse>(`/collections/${encodeURIComponent(name)}`, {
      method: 'GET',
    });
    const { result } = response;
    const { vectors } = result.config.params;

    return {
      name,
      vectorSize: vectors.size,
      distance: DISTANCE_FROM_QDRANT[vectors.distance],
      pointsCount: result.points_count,
      status: this.normalizeStatus(result.status),
    };
  }

  protected async rawDeleteCollection(name: string): Promise<void> {
    await this.request(`/collections/${encodeURIComponent(name)}`, { method: 'DELETE' });
  }

  protected async rawCollectionExists(name: string): Promise<boolean> {
    try {
      await this.rawGetCollectionInfo(name);
      return true;
    } catch (error) {
      if (error instanceof VectorStoreNotFoundError) return false;
      throw error;
    }
  }

  protected async rawUpsertBatch<TPayload>(
    collection: string,
    records: VectorRecord<TPayload>[]
  ): Promise<UpsertResult> {
    const points: QdrantPoint[] = records.map((record) => ({
      id: record.id,
      vector: record.vector,
      payload: record.payload as Record<string, unknown> | undefined,
    }));

    await this.request<QdrantUpsertResponse>(`/collections/${encodeURIComponent(collection)}/points?wait=true`, {
      method: 'PUT',
      body: JSON.stringify({ points }),
    });

    return { upsertedCount: points.length, ids: points.map((p) => p.id) };
  }

  protected async rawSearch<TPayload>(
    collection: string,
    query: VectorSearchQuery
  ): Promise<VectorSearchResult<TPayload>[]> {
    const response = await this.request<QdrantSearchResponse>(
      `/collections/${encodeURIComponent(collection)}/points/search`,
      {
        method: 'POST',
        body: JSON.stringify({
          vector: query.vector,
          limit: query.topK,
          filter: toQdrantFilter(query.filter),
          score_threshold: query.scoreThreshold,
          with_payload: query.withPayload,
          with_vector: query.withVector,
        }),
      }
    );

    return response.result.map((point) => ({
      id: point.id,
      score: point.score,
      payload: point.payload as TPayload | undefined,
      vector: point.vector,
    }));
  }

  protected async rawGetById<TPayload>(collection: string, ids: VectorId[]): Promise<VectorRecord<TPayload>[]> {
    const response = await this.request<QdrantRetrieveResponse>(
      `/collections/${encodeURIComponent(collection)}/points`,
      {
        method: 'POST',
        body: JSON.stringify({ ids, with_payload: true, with_vector: true }),
      }
    );

    return response.result.map((point) => ({
      id: point.id,
      vector: point.vector,
      payload: point.payload as TPayload | undefined,
    }));
  }

  protected async rawDelete(collection: string, ids: VectorId[]): Promise<DeleteResult> {
    await this.request(`/collections/${encodeURIComponent(collection)}/points/delete?wait=true`, {
      method: 'POST',
      body: JSON.stringify({ points: ids }),
    });
    return { deletedCount: ids.length };
  }

  protected async rawDeleteByFilter(collection: string, filter: VectorFilter): Promise<DeleteResult> {
    // Qdrant's delete-by-filter response doesn't report how many points
    // matched (see README "Known limitations"), so the count is taken
    // just before the delete. This is a best-effort number, not a
    // transactionally exact one — concurrent writers could make it drift.
    const matched = await this.rawCount(collection, filter);

    await this.request(`/collections/${encodeURIComponent(collection)}/points/delete?wait=true`, {
      method: 'POST',
      body: JSON.stringify({ filter: toQdrantFilter(filter) }),
    });

    return { deletedCount: matched };
  }

  protected async rawCount(collection: string, filter?: VectorFilter): Promise<number> {
    const response = await this.request<QdrantCountResponse>(
      `/collections/${encodeURIComponent(collection)}/points/count`,
      {
        method: 'POST',
        body: JSON.stringify({ filter: toQdrantFilter(filter), exact: true }),
      }
    );
    return response.result.count;
  }

  protected async rawHealthCheck(): Promise<boolean> {
    await this.request(`/healthz`, { method: 'GET' });
    return true;
  }

  private normalizeStatus(status: string): CollectionStatus {
    const normalized = status.toLowerCase();
    if (normalized === 'green' || normalized === 'yellow' || normalized === 'red' || normalized === 'grey') {
      return normalized;
    }
    return 'grey';
  }
}

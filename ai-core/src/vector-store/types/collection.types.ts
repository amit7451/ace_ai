import { DistanceMetric } from './vector-store-config.types';

/**
 * Config for `createCollection()` / `getOrCreateCollection()`.
 *
 * A collection is fixed-dimension for its lifetime — this is Qdrant's
 * constraint, not an arbitrary choice by this layer. `vectorSize` must
 * match whatever embedding model (Component 2) will write into it.
 */
export interface CreateCollectionConfig {
  /** Collection name. Alphanumeric plus "_"/"-" — see `createCollectionConfigSchema`. */
  name: string;
  /** Must equal the dimensionality of the embedding model that will populate this collection. */
  vectorSize: number;
  /** Defaults to 'cosine'. */
  distance?: DistanceMetric;
  /** Keep payloads on disk instead of in memory. Default false (matches Qdrant's default). */
  onDiskPayload?: boolean;
  /**
   * If true and the collection already exists, it is deleted and
   * recreated. Destructive — use only for deliberate reindexing/dimension
   * migrations, never as a default.
   */
  recreateIfExists?: boolean;
}

export type CollectionStatus = 'green' | 'yellow' | 'red' | 'grey';

export interface CollectionInfo {
  name: string;
  vectorSize: number;
  distance: DistanceMetric;
  pointsCount: number;
  status: CollectionStatus;
}

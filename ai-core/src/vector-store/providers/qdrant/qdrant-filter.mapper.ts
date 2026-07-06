import { FilterCondition, VectorFilter } from '../../types/search.types';
import { QdrantFilter, QdrantFilterCondition } from './qdrant.types';

function mapCondition(condition: FilterCondition): QdrantFilterCondition {
  return {
    key: condition.key,
    ...(condition.match ? { match: condition.match } : {}),
    ...(condition.range ? { range: condition.range } : {}),
  };
}

/**
 * Translates the provider-agnostic `VectorFilter` into Qdrant's
 * must/should/must_not JSON shape. This is the only place that knows
 * Qdrant's filter syntax — a future Pinecone/Weaviate provider would
 * implement its own equivalent mapper instead of touching this one.
 */
export function toQdrantFilter(filter?: VectorFilter): QdrantFilter | undefined {
  if (!filter) return undefined;

  const mapped: QdrantFilter = {};
  if (filter.must?.length) mapped.must = filter.must.map(mapCondition);
  if (filter.should?.length) mapped.should = filter.should.map(mapCondition);
  if (filter.mustNot?.length) mapped.must_not = filter.mustNot.map(mapCondition);

  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

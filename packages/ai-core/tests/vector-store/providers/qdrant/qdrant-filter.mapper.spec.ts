import { toQdrantFilter } from '../../../../src/vector-store/providers/qdrant/qdrant-filter.mapper';

describe('toQdrantFilter', () => {
  it('returns undefined for an undefined filter', () => {
    expect(toQdrantFilter(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty filter object', () => {
    expect(toQdrantFilter({})).toBeUndefined();
  });

  it('maps a "must" match condition', () => {
    const result = toQdrantFilter({
      must: [{ key: 'tenantId', match: { value: 'tenant_1' } }],
    });
    expect(result).toEqual({ must: [{ key: 'tenantId', match: { value: 'tenant_1' } }] });
  });

  it('maps "should" and "must_not" clauses together with a range condition', () => {
    const result = toQdrantFilter({
      should: [{ key: 'sourceType', match: { any: ['document', 'website'] } }],
      mustNot: [{ key: 'chunkIndex', range: { gte: 100 } }],
    });
    expect(result).toEqual({
      should: [{ key: 'sourceType', match: { any: ['document', 'website'] } }],
      must_not: [{ key: 'chunkIndex', range: { gte: 100 } }],
    });
  });

  it('omits clauses that are empty arrays', () => {
    const result = toQdrantFilter({ must: [], should: [{ key: 'a', match: { value: 1 } }] });
    expect(result).toEqual({ should: [{ key: 'a', match: { value: 1 } }] });
  });
});

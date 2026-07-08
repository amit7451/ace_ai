import type { VectorFilter } from '../../vector-store/types/search.types';

/**
 * Unconditionally ANDs `tenantId`/`assistantId` match conditions into
 * whatever filter the caller supplied. Tenant isolation (architecture
 * doc, Principle 2: "No tenant can access another tenant's resources") is
 * not something a caller can opt out of by omitting a filter — every
 * search this retriever runs is scoped, whether or not the collection
 * topology (Component 3's "one collection per assistant" vs. "one shared
 * collection") would already provide isolation on its own. Defense in
 * depth, not redundant caution.
 */
export function buildTenantFilter(tenantId: string, assistantId: string, userFilter?: VectorFilter): VectorFilter {
  return {
    must: [{ key: 'tenantId', match: { value: tenantId } }, { key: 'assistantId', match: { value: assistantId } }, ...(userFilter?.must ?? [])],
    should: userFilter?.should,
    mustNot: userFilter?.mustNot,
  };
}

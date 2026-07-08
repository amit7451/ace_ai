import { buildTenantFilter } from '../../../src/retriever/utils/tenant-filter';

describe('buildTenantFilter', () => {
  it('always includes tenantId and assistantId match conditions', () => {
    const filter = buildTenantFilter('tenant_1', 'assistant_abc');
    expect(filter.must).toEqual(
      expect.arrayContaining([
        { key: 'tenantId', match: { value: 'tenant_1' } },
        { key: 'assistantId', match: { value: 'assistant_abc' } },
      ]),
    );
  });

  it('merges the caller-supplied filter must clauses alongside tenant isolation, never replacing it', () => {
    const filter = buildTenantFilter('tenant_1', 'assistant_abc', {
      must: [{ key: 'sourceType', match: { value: 'faq' } }],
    });
    expect(filter.must).toHaveLength(3);
    expect(filter.must).toEqual(
      expect.arrayContaining([
        { key: 'tenantId', match: { value: 'tenant_1' } },
        { key: 'assistantId', match: { value: 'assistant_abc' } },
        { key: 'sourceType', match: { value: 'faq' } },
      ]),
    );
  });

  it('passes through should/mustNot from the caller filter unchanged', () => {
    const filter = buildTenantFilter('tenant_1', 'assistant_abc', {
      should: [{ key: 'sourceType', match: { value: 'faq' } }],
      mustNot: [{ key: 'sourceType', match: { value: 'other' } }],
    });
    expect(filter.should).toEqual([{ key: 'sourceType', match: { value: 'faq' } }]);
    expect(filter.mustNot).toEqual([{ key: 'sourceType', match: { value: 'other' } }]);
  });
});

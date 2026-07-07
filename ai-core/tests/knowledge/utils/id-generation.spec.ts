import { deterministicUuidV5 } from '../../../src/knowledge/utils/id-generation';

const UUID_V5_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('deterministicUuidV5', () => {
  it('produces a spec-valid UUIDv5 string (Qdrant point-ID compatible)', () => {
    const id = deterministicUuidV5('doc_1:0');
    expect(id).toMatch(UUID_V5_REGEX);
  });

  it('is deterministic: the same name always produces the same UUID', () => {
    const first = deterministicUuidV5('doc_42:3');
    const second = deterministicUuidV5('doc_42:3');
    expect(first).toBe(second);
  });

  it('produces different UUIDs for different names', () => {
    const a = deterministicUuidV5('doc_1:0');
    const b = deterministicUuidV5('doc_1:1');
    const c = deterministicUuidV5('doc_2:0');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it('produces different UUIDs for different namespaces given the same name', () => {
    const a = deterministicUuidV5('same-name', '6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    const b = deterministicUuidV5('same-name', '6ba7b811-9dad-11d1-80b4-00c04fd430c8');
    expect(a).not.toBe(b);
  });
});

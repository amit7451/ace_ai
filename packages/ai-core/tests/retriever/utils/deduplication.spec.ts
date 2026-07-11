import { deduplicateByText } from '../../../src/retriever/utils/deduplication';
import type { VectorSearchResult } from '../../../src/vector-store/types/search.types';
import type { KnowledgeVectorPayload } from '../../../src/vector-store/types/vector-record.types';

function makePayload(text: string): KnowledgeVectorPayload {
  return {
    tenantId: 't1',
    assistantId: 'a1',
    documentId: 'd1',
    chunkId: 'c1',
    chunkIndex: 0,
    text,
    sourceType: 'document',
    createdAt: new Date().toISOString(),
  };
}

function result(id: string, text: string, score = 0.9): VectorSearchResult<KnowledgeVectorPayload> {
  return { id, score, payload: makePayload(text) };
}

describe('deduplicateByText', () => {
  it('keeps the first occurrence and drops exact-duplicate text', () => {
    const results = [
      result('a', 'Our refund policy allows returns within 30 days.'),
      result('b', 'Our refund policy allows returns within 30 days.'),
    ];
    const deduped = deduplicateByText(results);
    expect(deduped.map((r) => r.id)).toEqual(['a']);
  });

  it('treats whitespace and case differences as the same text', () => {
    const results = [
      result('a', 'Refund Policy: 30 days.'),
      result('b', '  refund   policy:   30 days.  '),
    ];
    const deduped = deduplicateByText(results);
    expect(deduped).toHaveLength(1);
  });

  it('keeps genuinely different chunks', () => {
    const results = [result('a', 'Refund policy text.'), result('b', 'Shipping policy text.')];
    const deduped = deduplicateByText(results);
    expect(deduped.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('preserves original rank order among kept results', () => {
    const results = [
      result('a', 'First', 0.95),
      result('b', 'Second', 0.8),
      result('c', 'Third', 0.6),
    ];
    const deduped = deduplicateByText(results);
    expect(deduped.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('passes through results with no payload text unaffected', () => {
    const results: VectorSearchResult<KnowledgeVectorPayload>[] = [
      { id: 'a', score: 0.9 },
      { id: 'b', score: 0.8 },
    ];
    expect(deduplicateByText(results)).toHaveLength(2);
  });
});

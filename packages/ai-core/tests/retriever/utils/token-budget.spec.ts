import { trimToTokenBudget } from '../../../src/retriever/utils/token-budget';
import type { VectorSearchResult } from '../../../src/vector-store/types/search.types';
import type { KnowledgeVectorPayload } from '../../../src/vector-store/types/vector-record.types';

function result(id: string, text: string): VectorSearchResult<KnowledgeVectorPayload> {
  return {
    id,
    score: 0.9,
    payload: {
      tenantId: 't1',
      assistantId: 'a1',
      documentId: 'd1',
      chunkId: id,
      chunkIndex: 0,
      text,
      sourceType: 'document',
      createdAt: new Date().toISOString(),
    },
  };
}

describe('trimToTokenBudget', () => {
  it('keeps chunks in rank order until the next one would exceed the budget', () => {
    // "a".repeat(40) ~ 10 tokens each (chars/4)
    const results = [
      result('a', 'a'.repeat(40)),
      result('b', 'a'.repeat(40)),
      result('c', 'a'.repeat(40)),
    ];
    const trimmed = trimToTokenBudget(results, 25); // fits 2 chunks (20 tokens), not a 3rd (30 tokens)
    expect(trimmed.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('always keeps at least the first chunk, even if it alone exceeds the budget', () => {
    const results = [result('a', 'a'.repeat(400))];
    const trimmed = trimToTokenBudget(results, 1);
    expect(trimmed.map((r) => r.id)).toEqual(['a']);
  });

  it('keeps everything when the budget comfortably covers all chunks', () => {
    const results = [result('a', 'short'), result('b', 'short')];
    const trimmed = trimToTokenBudget(results, 1000);
    expect(trimmed).toHaveLength(2);
  });
});

import type { VectorSearchResult } from '../../vector-store/types/search.types';
import type { KnowledgeVectorPayload } from '../../vector-store/types/vector-record.types';
import { estimateTokens } from './token-estimation';

/**
 * Greedily keeps chunks in rank order until adding the next one would
 * exceed `maxTokens`. Always keeps at least the first (best-ranked) chunk
 * even if it alone exceeds the budget — returning zero chunks because the
 * single best match is long is worse than slightly over-budget.
 */
export function trimToTokenBudget<TPayload extends { text?: unknown } = KnowledgeVectorPayload>(
  results: VectorSearchResult<TPayload>[],
  maxTokens: number
): VectorSearchResult<TPayload>[] {
  const kept: VectorSearchResult<TPayload>[] = [];
  let runningTokens = 0;

  for (const result of results) {
    const text = typeof result.payload?.text === 'string' ? result.payload.text : '';
    const tokens = estimateTokens(text);
    if (kept.length > 0 && runningTokens + tokens > maxTokens) break;
    kept.push(result);
    runningTokens += tokens;
  }

  return kept;
}

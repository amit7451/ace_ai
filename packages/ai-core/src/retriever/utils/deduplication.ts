import type { VectorSearchResult } from '../../vector-store/types/search.types';
import type { KnowledgeVectorPayload } from '../../vector-store/types/vector-record.types';

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Drops chunks whose text is identical (after whitespace/case
 * normalization) to one already kept, preserving rank order. Catches the
 * common real-world case of overlapping chunk windows (Component 4's
 * `fixed-size`/`recursive` strategies with overlap > 0) or the same
 * content chunked from two different source documents.
 *
 * Does NOT catch near-duplicates with different wording — that would need
 * a fuzzy/embedding-similarity comparison across every pair of candidates,
 * which is real cost for a benefit this platform doesn't need yet (see
 * README, "Known limitations").
 */
export function deduplicateByText<TPayload extends { text?: unknown } = KnowledgeVectorPayload>(
  results: VectorSearchResult<TPayload>[]
): VectorSearchResult<TPayload>[] {
  const seen = new Set<string>();
  const deduped: VectorSearchResult<TPayload>[] = [];

  for (const result of results) {
    const text = typeof result.payload?.text === 'string' ? result.payload.text : undefined;
    const key = text ? normalizeText(text) : undefined;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    deduped.push(result);
  }

  return deduped;
}

/**
 * Cheap heuristic (chars / 4) — the same known-limitation approach used by
 * `estimateTokens` in the LLM Provider Layer and Embedding Provider Layer.
 * Duplicated here rather than imported (this component stays self-contained,
 * same tradeoff Component 2 made relative to Component 1 — see
 * INTEGRATION.md for the optional de-duplication path). Good enough for
 * reporting `KnowledgeChunk.tokenCount` so a caller can pre-flight
 * `embedBatch` sizing; never use it for billing.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

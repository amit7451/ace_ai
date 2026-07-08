/**
 * Cheap heuristic (chars / 4) — same known-limitation approach as
 * Components 1, 2, and 4. Duplicated here rather than imported for the
 * same self-containment tradeoff Component 4 documented relative to
 * Component 2 (see its README / INTEGRATION.md). Used only for the
 * optional `maxContextTokens` trimming step — never for billing.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

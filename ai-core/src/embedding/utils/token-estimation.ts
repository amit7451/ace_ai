/**
 * Cheap heuristic (chars / 4) — the same known-limitation approach used by
 * `estimateTokens` in the LLM Provider Layer. Good enough for pre-flight
 * batch-size sanity checks and as a usage fallback for vendors (Gemini,
 * Ollama) whose embedding endpoints don't return real token counts. Never
 * use this for billing or hard context-window enforcement; prefer
 * `EmbeddingResponse.usage` from vendors that report it (OpenAI, Cohere).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function truncateToApproxTokenLimit(text: string, maxTokens: number): string {
  const approxCharLimit = maxTokens * 4;
  if (text.length <= approxCharLimit) return text;
  return text.slice(0, approxCharLimit);
}

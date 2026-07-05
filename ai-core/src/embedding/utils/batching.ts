/**
 * Splits an array into chunks of at most `size`. Used to keep every vendor
 * call within its documented max-inputs-per-request limit — batching is to
 * this layer what streaming is to the LLM Provider Layer: the thing every
 * provider must handle correctly and consistently.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error('chunkArray: size must be a positive integer');
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

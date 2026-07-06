/** Splits `items` into chunks of at most `size`. Used by `upsertBatch` to stay under each vendor's safe request size. */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error('Chunk size must be greater than 0');
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

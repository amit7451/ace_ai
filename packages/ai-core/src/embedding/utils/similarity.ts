function assertSameLength(a: number[], b: number[]): void {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
}

export function dotProduct(a: number[], b: number[]): number {
  assertSameLength(a, b);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function magnitude(a: number[]): number {
  return Math.sqrt(dotProduct(a, a));
}

/**
 * Cosine similarity in [-1, 1]; 1 = identical direction. This is the metric
 * most vector databases (including Qdrant, Component 3) default to for
 * normalized embeddings. Included here so retrieval quality can be sanity
 * checked in a unit test without spinning up a live vector DB.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  assertSameLength(a, b);
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

export function euclideanDistance(a: number[], b: number[]): number {
  assertSameLength(a, b);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

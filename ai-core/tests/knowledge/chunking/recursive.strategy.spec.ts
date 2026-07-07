import { RecursiveChunkingStrategy } from '../../../src/knowledge/chunking/recursive/recursive-chunking.strategy';

describe('RecursiveChunkingStrategy', () => {
  const strategy = new RecursiveChunkingStrategy();

  it('returns the whole text as one chunk when it fits', () => {
    const result = strategy.chunk({ text: 'short text' }, { maxChunkSize: 100, chunkOverlap: 10 });
    expect(result).toEqual([{ text: 'short text' }]);
  });

  it('splits long text into multiple chunks, each within maxChunkSize', () => {
    const text = Array.from({ length: 10 }, (_, i) => `Paragraph number ${i}. `.repeat(5)).join('\n\n');
    const result = strategy.chunk({ text }, { maxChunkSize: 200, chunkOverlap: 20 });
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(200);
    }
  });

  it('reports its name', () => {
    expect(strategy.name).toBe('recursive');
  });
});

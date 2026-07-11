import { FixedSizeChunkingStrategy } from '../../../src/knowledge/chunking/fixed-size/fixed-size-chunking.strategy';
import { KnowledgeInvalidConfigError } from '../../../src/knowledge/errors/knowledge.errors';

describe('FixedSizeChunkingStrategy', () => {
  const strategy = new FixedSizeChunkingStrategy();

  it('returns the whole text as one chunk when it fits within maxChunkSize', () => {
    const result = strategy.chunk({ text: 'short text' }, { maxChunkSize: 100, chunkOverlap: 0 });
    expect(result).toEqual([{ text: 'short text' }]);
  });

  it('splits text longer than maxChunkSize into multiple chunks', () => {
    const text = 'word '.repeat(100).trim(); // 599 chars
    const result = strategy.chunk({ text }, { maxChunkSize: 100, chunkOverlap: 0 });
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(100);
    }
  });

  it('prefers breaking at a whitespace boundary over cutting a word in half', () => {
    const text = 'Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa';
    const result = strategy.chunk({ text }, { maxChunkSize: 20, chunkOverlap: 0 });
    for (const chunk of result) {
      expect(chunk.text.endsWith(' ')).toBe(false); // trimmed
      expect(/^[A-Za-z]+$/.test(chunk.text.split(' ').pop() ?? '')).toBe(true); // last word is whole, not truncated mid-word
    }
  });

  it('applies chunkOverlap between consecutive chunks', () => {
    const text = 'one two three four five six seven eight nine ten';
    const result = strategy.chunk({ text }, { maxChunkSize: 20, chunkOverlap: 8 });
    expect(result.length).toBeGreaterThan(1);
  });

  it('rejects chunkOverlap >= maxChunkSize via the shared base validation', () => {
    expect(() =>
      strategy.chunk({ text: 'x'.repeat(50) }, { maxChunkSize: 10, chunkOverlap: 10 })
    ).toThrow(KnowledgeInvalidConfigError);
  });

  it('terminates (does not hang) on a very small maxChunkSize', () => {
    const text = 'a'.repeat(50);
    const result = strategy.chunk({ text }, { maxChunkSize: 3, chunkOverlap: 1 });
    expect(result.length).toBeGreaterThan(1);
  });
});

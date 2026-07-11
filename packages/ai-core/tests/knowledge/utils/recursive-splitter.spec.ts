import { splitRecursively } from '../../../src/knowledge/utils/recursive-splitter';

describe('splitRecursively', () => {
  it('returns the whole text as one chunk when it already fits', () => {
    const text = 'short text';
    expect(splitRecursively(text, 100, 10)).toEqual([text]);
  });

  it('returns an empty array for empty/whitespace-only input', () => {
    expect(splitRecursively('', 100, 10)).toEqual([]);
    expect(splitRecursively('   \n  ', 100, 10)).toEqual([]);
  });

  it('never produces a chunk longer than maxChunkSize', () => {
    const paragraphs = Array.from({ length: 20 }, (_, i) => `Paragraph ${i}. `.repeat(10)).join(
      '\n\n'
    );
    const chunks = splitRecursively(paragraphs, 200, 20);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(200);
    }
  });

  it('splits on paragraph boundaries when possible, keeping each paragraph intact if it fits', () => {
    const text = 'First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph here.';
    const chunks = splitRecursively(text, 30, 0);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.some((c) => c.includes('First paragraph'))).toBe(true);
    expect(chunks.some((c) => c.includes('Second paragraph'))).toBe(true);
    expect(chunks.some((c) => c.includes('Third paragraph'))).toBe(true);
  });

  it('merges several small paragraphs into a single chunk when they fit together', () => {
    const text = 'A.\n\nB.\n\nC.';
    const chunks = splitRecursively(text, 1000, 0);
    expect(chunks).toEqual(['A.\n\nB.\n\nC.']);
  });

  it('falls through to sentence-level splitting when a paragraph has no line breaks but is too long', () => {
    const text =
      'Sentence one is here. Sentence two is here. Sentence three is here. Sentence four is here.';
    const chunks = splitRecursively(text, 40, 0);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(40);
    }
    expect(chunks.join(' ')).toContain('Sentence one is here.');
  });

  it('hard-slices a single unbreakable "word" longer than maxChunkSize', () => {
    const text = 'a'.repeat(500);
    const chunks = splitRecursively(text, 100, 0);
    expect(chunks.length).toBe(5);
    expect(chunks.every((c) => c.length === 100)).toBe(true);
    expect(chunks.join('')).toBe(text);
  });

  it('applies chunkOverlap between consecutive chunks', () => {
    const text = Array.from({ length: 10 }, (_, i) => `This is sentence number ${i}.`).join(' ');
    const chunks = splitRecursively(text, 60, 20);
    expect(chunks.length).toBeGreaterThan(1);
    // The tail of chunk N should reappear at the start of chunk N+1.
    for (let i = 0; i < chunks.length - 1; i++) {
      const tail = chunks[i].slice(-10);
      expect(chunks[i + 1].startsWith(tail) || chunks[i + 1].includes(tail)).toBe(true);
    }
  });

  it('produces no chunk exceeding maxChunkSize even with aggressive overlap', () => {
    const text = 'word '.repeat(200).trim();
    const chunks = splitRecursively(text, 50, 45);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(50);
    }
  });

  it('reconstructs all non-whitespace content across chunks (nothing silently dropped)', () => {
    const text =
      'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi.';
    const chunks = splitRecursively(text, 25, 5);
    const words = [
      'Alpha',
      'beta',
      'gamma',
      'delta',
      'epsilon',
      'zeta',
      'eta',
      'theta',
      'iota',
      'kappa',
      'lambda',
      'mu',
      'nu',
      'xi',
      'omicron',
      'pi',
    ];
    const joined = chunks.join(' ');
    for (const word of words) {
      expect(joined).toContain(word);
    }
  });
});

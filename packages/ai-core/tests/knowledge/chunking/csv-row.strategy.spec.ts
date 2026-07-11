import { CsvRowChunkingStrategy } from '../../../src/knowledge/chunking/csv-row/csv-row-chunking.strategy';
import { CsvParser } from '../../../src/knowledge/parsers/csv/csv.parser';

describe('CsvRowChunkingStrategy', () => {
  const strategy = new CsvRowChunkingStrategy();
  const parser = new CsvParser();

  it('produces one chunk per row by default (rowsPerChunk = 1)', () => {
    const parsed = parser.parse({ content: 'q,a\nQ1,A1\nQ2,A2\nQ3,A3' });
    const result = strategy.chunk(parsed, { maxChunkSize: 1000, chunkOverlap: 0 });
    expect(result).toHaveLength(3);
    expect(result[0].text).toBe('q: Q1 | a: A1');
    expect(result[0].metadata).toEqual({ rowRange: [0, 0] });
  });

  it('groups multiple rows per chunk when rowsPerChunk > 1', () => {
    const parsed = parser.parse({ content: 'q,a\nQ1,A1\nQ2,A2\nQ3,A3\nQ4,A4' });
    const result = strategy.chunk(parsed, { maxChunkSize: 1000, chunkOverlap: 0, rowsPerChunk: 2 });
    expect(result).toHaveLength(2);
    expect(result[0].metadata).toEqual({ rowRange: [0, 1] });
    expect(result[1].metadata).toEqual({ rowRange: [2, 3] });
  });

  it('falls back to recursive chunking when no CSV row structure is present', () => {
    const result = strategy.chunk(
      { text: 'plain text with no csv structure at all here' },
      { maxChunkSize: 20, chunkOverlap: 5 }
    );
    expect(result.length).toBeGreaterThan(0);
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(20);
    }
  });
});

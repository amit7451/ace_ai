import { MarkdownAwareChunkingStrategy } from '../../../src/knowledge/chunking/markdown-aware/markdown-aware-chunking.strategy';
import { MarkdownParser } from '../../../src/knowledge/parsers/markdown/markdown.parser';

describe('MarkdownAwareChunkingStrategy', () => {
  const strategy = new MarkdownAwareChunkingStrategy();
  const parser = new MarkdownParser();

  it('prefixes each chunk with its header breadcrumb', () => {
    const parsed = parser.parse({
      content: ['# Getting Started', '', '## Installation', 'Run npm install to get started.'].join(
        '\n'
      ),
    });
    const result = strategy.chunk(parsed, { maxChunkSize: 500, chunkOverlap: 0 });
    expect(result.some((c) => c.text.startsWith('Getting Started > Installation'))).toBe(true);
    expect(
      result.some(
        (c) =>
          c.metadata?.headerPath && (c.metadata.headerPath as string[]).includes('Installation')
      )
    ).toBe(true);
  });

  it('splits an over-long section into multiple chunks, each carrying the same header prefix', () => {
    const longBody = 'Sentence about the topic. '.repeat(50);
    const parsed = parser.parse({ content: `# Big Section\n${longBody}` });
    const result = strategy.chunk(parsed, { maxChunkSize: 150, chunkOverlap: 10 });
    expect(result.length).toBeGreaterThan(1);
    for (const chunk of result) {
      expect(chunk.text.startsWith('Big Section')).toBe(true);
      expect(chunk.text.length).toBeLessThanOrEqual(150);
    }
  });

  it('falls back to plain recursive chunking when no markdown structure is present', () => {
    const result = strategy.chunk(
      { text: 'Just plain text with no headers at all, repeated. '.repeat(10) },
      { maxChunkSize: 100, chunkOverlap: 10 }
    );
    expect(result.length).toBeGreaterThan(0);
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(100);
    }
  });

  it('does not attach headerPath metadata to the headerless intro section', () => {
    const parsed = parser.parse({
      content: ['Intro before any header.', '', '# First', 'Body text.'].join('\n'),
    });
    const result = strategy.chunk(parsed, { maxChunkSize: 500, chunkOverlap: 0 });
    const introChunk = result.find((c) => c.text.includes('Intro before any header.'));
    expect(introChunk?.metadata).toBeUndefined();
  });
});

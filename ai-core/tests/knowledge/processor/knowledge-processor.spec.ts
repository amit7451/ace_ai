import { KnowledgeProcessor, inferFormat, resolveChunkingOptions, toKnowledgeVectorPayload } from '../../../src/knowledge/processor/knowledge-processor';
import { KnowledgeEmptyContentError } from '../../../src/knowledge/errors/knowledge.errors';

describe('KnowledgeProcessor', () => {
  const processor = new KnowledgeProcessor();

  const baseConfig = { tenantId: 'tenant_1', assistantId: 'assistant_1', documentId: 'doc_1' };

  it('processes plain text end-to-end into KnowledgeChunk objects', () => {
    const chunks = processor.process({ content: 'This is a simple knowledge base article about refunds.' }, baseConfig);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]).toMatchObject({
      documentId: 'doc_1',
      tenantId: 'tenant_1',
      assistantId: 'assistant_1',
      chunkIndex: 0,
      sourceType: 'document',
    });
    expect(typeof chunks[0].chunkId).toBe('string');
    expect(typeof chunks[0].tokenCount).toBe('number');
    expect(typeof chunks[0].createdAt).toBe('string');
  });

  it('infers markdown format from fileName and defaults to the markdown-aware strategy', () => {
    const chunks = processor.process(
      { content: '# Policy\nWe offer a 30 day refund window.', fileName: 'policy.md' },
      baseConfig,
    );
    expect(chunks[0].text.startsWith('Policy')).toBe(true);
    expect(chunks[0].metadata?.headerPath).toEqual(['Policy']);
  });

  it('infers csv format from mimeType and defaults sourceType to faq', () => {
    const chunks = processor.process(
      { content: 'question,answer\nWhat are your hours?,9-5 daily.', mimeType: 'text/csv' },
      baseConfig,
    );
    expect(chunks[0].sourceType).toBe('faq');
    expect(chunks[0].text).toContain('question: What are your hours?');
  });

  it('infers html format and defaults sourceType to website', () => {
    const chunks = processor.process({ content: '<p>Welcome to our site.</p>', mimeType: 'text/html' }, baseConfig);
    expect(chunks[0].sourceType).toBe('website');
    expect(chunks[0].text).toBe('Welcome to our site.');
  });

  it('respects an explicit format/strategy/sourceType override even when it disagrees with inference', () => {
    const chunks = processor.process(
      { content: 'Plain text content here.', fileName: 'notes.md' },
      { ...baseConfig, format: 'plain-text', sourceType: 'manual' },
    );
    expect(chunks[0].sourceType).toBe('manual');
  });

  it('produces identical chunk IDs across two runs on the same document (idempotent reindexing)', () => {
    const input = { content: 'Stable content that will be reprocessed twice.' };
    const first = processor.process(input, baseConfig);
    const second = processor.process(input, baseConfig);
    expect(first.map((c) => c.chunkId)).toEqual(second.map((c) => c.chunkId));
  });

  it('produces different chunk IDs for a different documentId given the same content', () => {
    const input = { content: 'Some shared content.' };
    const forDocA = processor.process(input, { ...baseConfig, documentId: 'doc_a' });
    const forDocB = processor.process(input, { ...baseConfig, documentId: 'doc_b' });
    expect(forDocA[0].chunkId).not.toBe(forDocB[0].chunkId);
  });

  it('throws KnowledgeEmptyContentError for whitespace-only input', () => {
    expect(() => processor.process({ content: '   ' }, baseConfig)).toThrow(KnowledgeEmptyContentError);
  });

  it('throws on missing required config fields', () => {
    expect(() => processor.process({ content: 'text' }, { tenantId: '', assistantId: 'a', documentId: 'd' })).toThrow();
  });

  it('merges a partial chunking override over format defaults', () => {
    const longText = 'Sentence. '.repeat(200);
    const chunks = processor.process({ content: longText }, { ...baseConfig, chunking: { maxChunkSize: 100, chunkOverlap: 20 } });
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(100);
    }
  });
});

describe('inferFormat', () => {
  it('prefers mimeType over fileName when both are present', () => {
    expect(inferFormat({ content: 'x', mimeType: 'text/csv', fileName: 'notes.md' })).toBe('csv');
  });

  it('falls back to fileName extension when mimeType is absent', () => {
    expect(inferFormat({ content: 'x', fileName: 'readme.md' })).toBe('markdown');
    expect(inferFormat({ content: 'x', fileName: 'page.html' })).toBe('html');
  });

  it('defaults to plain-text when neither mimeType nor fileName is informative', () => {
    expect(inferFormat({ content: 'x' })).toBe('plain-text');
  });
});

describe('resolveChunkingOptions', () => {
  it('applies csv-specific defaults (rowsPerChunk, zero overlap)', () => {
    const options = resolveChunkingOptions('csv');
    expect(options.rowsPerChunk).toBe(1);
    expect(options.chunkOverlap).toBe(0);
  });

  it('lets an override win over the format default', () => {
    const options = resolveChunkingOptions('plain-text', { maxChunkSize: 250 });
    expect(options.maxChunkSize).toBe(250);
    expect(options.chunkOverlap).toBe(150); // untouched default
  });

  it('rejects a resolved config where overlap >= maxChunkSize (surfaced as a Zod validation error, same as Components 1-3\'s schema.parse() calls)', () => {
    expect(() => resolveChunkingOptions('plain-text', { maxChunkSize: 100, chunkOverlap: 100 })).toThrow(/chunkOverlap/);
  });
});

describe('toKnowledgeVectorPayload', () => {
  it('maps a KnowledgeChunk onto the Component 3 payload shape', () => {
    const chunk = {
      chunkId: 'c1',
      documentId: 'd1',
      tenantId: 't1',
      assistantId: 'a1',
      chunkIndex: 0,
      text: 'hello',
      sourceType: 'document' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      tokenCount: 2,
    };
    expect(toKnowledgeVectorPayload(chunk)).toEqual(chunk);
  });

  it('nests strategy metadata under a "metadata" key instead of flattening it', () => {
    const chunk = {
      chunkId: 'c1',
      documentId: 'd1',
      tenantId: 't1',
      assistantId: 'a1',
      chunkIndex: 0,
      text: 'hello',
      sourceType: 'document' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      tokenCount: 2,
      metadata: { headerPath: ['A', 'B'] },
    };
    const payload = toKnowledgeVectorPayload(chunk);
    expect(payload.metadata).toEqual({ headerPath: ['A', 'B'] });
    expect(payload.headerPath).toBeUndefined();
  });
});

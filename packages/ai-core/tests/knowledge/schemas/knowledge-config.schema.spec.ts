import {
  knowledgeProcessingConfigSchema,
  chunkingOptionsSchema,
} from '../../../src/knowledge/schemas/knowledge-config.schema';

describe('knowledgeProcessingConfigSchema', () => {
  it('accepts a minimal valid config', () => {
    const parsed = knowledgeProcessingConfigSchema.parse({
      tenantId: 't1',
      assistantId: 'a1',
      documentId: 'd1',
    });
    expect(parsed.tenantId).toBe('t1');
  });

  it('accepts an optional partial chunking override', () => {
    const parsed = knowledgeProcessingConfigSchema.parse({
      tenantId: 't1',
      assistantId: 'a1',
      documentId: 'd1',
      chunking: { maxChunkSize: 500 },
    });
    expect(parsed.chunking?.maxChunkSize).toBe(500);
  });

  it('rejects a missing tenantId', () => {
    expect(() =>
      knowledgeProcessingConfigSchema.parse({
        assistantId: 'a1',
        documentId: 'd1',
      })
    ).toThrow();
  });

  it('rejects an unknown format', () => {
    expect(() =>
      knowledgeProcessingConfigSchema.parse({
        tenantId: 't1',
        assistantId: 'a1',
        documentId: 'd1',
        format: 'pdf',
      })
    ).toThrow();
  });
});

describe('chunkingOptionsSchema', () => {
  it('applies defaults', () => {
    const parsed = chunkingOptionsSchema.parse({});
    expect(parsed.maxChunkSize).toBe(1000);
    expect(parsed.chunkOverlap).toBe(150);
  });

  it('rejects chunkOverlap >= maxChunkSize', () => {
    expect(() => chunkingOptionsSchema.parse({ maxChunkSize: 100, chunkOverlap: 100 })).toThrow();
    expect(() => chunkingOptionsSchema.parse({ maxChunkSize: 100, chunkOverlap: 150 })).toThrow();
  });

  it('accepts chunkOverlap smaller than maxChunkSize', () => {
    expect(() =>
      chunkingOptionsSchema.parse({ maxChunkSize: 100, chunkOverlap: 50 })
    ).not.toThrow();
  });
});

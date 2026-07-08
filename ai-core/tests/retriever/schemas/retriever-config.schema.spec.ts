import { retrieverConfigSchema, retrievalQuerySchema, vectorFilterSchema } from '../../../src/retriever/schemas/retriever-config.schema';

describe('retrieverConfigSchema', () => {
  it('applies defaults when only collection is provided', () => {
    const parsed = retrieverConfigSchema.parse({ collection: 'assistant_abc123' });
    expect(parsed).toEqual({
      collection: 'assistant_abc123',
      topK: 5,
      scoreThreshold: 0.5,
      strategy: 'similarity-threshold',
      mmrLambda: 0.5,
      maxContextTokens: undefined,
    });
  });

  it('rejects a missing collection', () => {
    expect(() => retrieverConfigSchema.parse({})).toThrow();
  });

  it('rejects an unsupported strategy name', () => {
    expect(() => retrieverConfigSchema.parse({ collection: 'c', strategy: 'random' })).toThrow();
  });

  it('rejects mmrLambda outside 0-1', () => {
    expect(() => retrieverConfigSchema.parse({ collection: 'c', mmrLambda: 1.5 })).toThrow();
  });

  it('accepts an explicit maxContextTokens override', () => {
    const parsed = retrieverConfigSchema.parse({ collection: 'c', maxContextTokens: 2000 });
    expect(parsed.maxContextTokens).toBe(2000);
  });
});

describe('retrievalQuerySchema', () => {
  it('accepts a minimal valid query', () => {
    const parsed = retrievalQuerySchema.parse({ query: 'What is your refund policy?', tenantId: 't1', assistantId: 'a1' });
    expect(parsed.query).toBe('What is your refund policy?');
  });

  it('trims the query and rejects a whitespace-only query', () => {
    expect(() => retrievalQuerySchema.parse({ query: '   ', tenantId: 't1', assistantId: 'a1' })).toThrow();
  });

  it('trims surrounding whitespace on an otherwise valid query', () => {
    const parsed = retrievalQuerySchema.parse({ query: '  hello  ', tenantId: 't1', assistantId: 'a1' });
    expect(parsed.query).toBe('hello');
  });

  it('rejects a missing tenantId or assistantId', () => {
    expect(() => retrievalQuerySchema.parse({ query: 'hi', assistantId: 'a1' })).toThrow();
    expect(() => retrievalQuerySchema.parse({ query: 'hi', tenantId: 't1' })).toThrow();
  });

  it('validates a structurally correct filter', () => {
    const parsed = retrievalQuerySchema.parse({
      query: 'hi',
      tenantId: 't1',
      assistantId: 'a1',
      filter: { must: [{ key: 'sourceType', match: { value: 'faq' } }] },
    });
    expect(parsed.filter?.must).toHaveLength(1);
  });

  it('rejects a malformed filter condition', () => {
    expect(() =>
      retrievalQuerySchema.parse({
        query: 'hi',
        tenantId: 't1',
        assistantId: 'a1',
        filter: { must: [{ key: 'sourceType', match: { notAValidShape: true } }] },
      }),
    ).toThrow();
  });
});

describe('vectorFilterSchema', () => {
  it('accepts a range condition', () => {
    const result = vectorFilterSchema.safeParse({ must: [{ key: 'chunkIndex', range: { gte: 0, lte: 10 } }] });
    expect(result.success).toBe(true);
  });

  it('accepts a match.any condition', () => {
    const result = vectorFilterSchema.safeParse({ must: [{ key: 'sourceType', match: { any: ['faq', 'document'] } }] });
    expect(result.success).toBe(true);
  });
});

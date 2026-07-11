import { PlainTextParser } from '../../../src/knowledge/parsers/plain-text/plain-text.parser';
import { KnowledgeEmptyContentError } from '../../../src/knowledge/errors/knowledge.errors';

describe('PlainTextParser', () => {
  const parser = new PlainTextParser();

  it('normalizes whitespace in the input', () => {
    const result = parser.parse({ content: 'Hello    world.\n\n\n\nBye.' });
    expect(result.text).toBe('Hello world.\n\nBye.');
  });

  it('throws KnowledgeEmptyContentError for empty content', () => {
    expect(() => parser.parse({ content: '' })).toThrow(KnowledgeEmptyContentError);
  });

  it('throws KnowledgeEmptyContentError for whitespace-only content', () => {
    expect(() => parser.parse({ content: '   \n  ' })).toThrow(KnowledgeEmptyContentError);
  });

  it('reports its format', () => {
    expect(parser.format).toBe('plain-text');
  });
});

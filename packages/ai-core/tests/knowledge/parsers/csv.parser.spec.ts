import { CsvParser } from '../../../src/knowledge/parsers/csv/csv.parser';
import { KnowledgeParsingError } from '../../../src/knowledge/errors/knowledge.errors';

describe('CsvParser', () => {
  const parser = new CsvParser();

  it('extracts header-mapped rows into structure.csvRows', () => {
    const csv = 'question,answer\nWhat is your refund policy?,30 days no questions asked.';
    const result = parser.parse({ content: csv });
    expect(result.structure?.csvRows).toEqual([
      {
        index: 0,
        record: { question: 'What is your refund policy?', answer: '30 days no questions asked.' },
      },
    ]);
  });

  it('renders rows as readable key: value text', () => {
    const csv = 'question,answer\nWhat are your hours?,9 to 5 Monday to Friday.';
    const result = parser.parse({ content: csv });
    expect(result.text).toBe('question: What are your hours? | answer: 9 to 5 Monday to Friday.');
  });

  it('handles multiple rows, each with the correct index', () => {
    const csv = 'a,b\n1,2\n3,4\n5,6';
    const result = parser.parse({ content: csv });
    expect(result.structure?.csvRows?.map((r) => r.index)).toEqual([0, 1, 2]);
  });

  it('falls back to a generated column name for a blank header cell', () => {
    const csv = 'name,\nAlice,extra-value';
    const result = parser.parse({ content: csv });
    expect(result.structure?.csvRows?.[0].record).toEqual({
      name: 'Alice',
      column_2: 'extra-value',
    });
  });

  it('throws KnowledgeParsingError when tokenizing yields zero rows despite non-empty input', () => {
    // A lone pair of quotes toggles quote-mode on and off without ever emitting a field or row,
    // so it passes BaseDocumentParser's empty-content guard (content.trim().length > 0) but still
    // leaves parseCsv() with nothing to return — the CsvParser's own defensive check for that case.
    expect(() => parser.parse({ content: '""' })).toThrow(KnowledgeParsingError);
  });
});

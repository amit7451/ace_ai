import { RawDocumentInput, ParsedDocument, CsvRow } from '../../types/knowledge-document.types';
import { BaseDocumentParser } from '../base/base-document-parser';
import { parseCsv } from '../../utils/csv-tokenizer';
import { KnowledgeParsingError } from '../../errors/knowledge.errors';

export class CsvParser extends BaseDocumentParser {
  readonly format = 'csv' as const;

  protected rawParse(input: RawDocumentInput): ParsedDocument {
    const rows = parseCsv(input.content);
    if (rows.length === 0) {
      throw new KnowledgeParsingError('csv', 'content contained no rows.');
    }

    const [headerRow, ...dataRows] = rows;
    const csvRows: CsvRow[] = dataRows.map((cells, index) => {
      const record: Record<string, string> = {};
      headerRow.forEach((header, col) => {
        const key = header.trim() || `column_${col + 1}`;
        record[key] = (cells[col] ?? '').trim();
      });
      return { index, record };
    });

    const text = csvRows
      .map((row) =>
        Object.entries(row.record)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' | '),
      )
      .join('\n');

    return { text, structure: { csvRows } };
  }
}

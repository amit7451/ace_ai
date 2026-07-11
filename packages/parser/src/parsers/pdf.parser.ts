import { IParser, Document } from '../interfaces/parser.interface';
import pdfParse from 'pdf-parse';

export class PdfParser implements IParser {
  async parse(buffer: Buffer): Promise<Document> {
    const data = await pdfParse(buffer);
    return {
      content: data.text,
      metadata: {
        pageCount: data.numpages,
        info: data.info,
      },
    };
  }
}

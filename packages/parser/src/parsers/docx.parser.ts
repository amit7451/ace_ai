import { IParser, Document } from '../interfaces/parser.interface';
import mammoth from 'mammoth';

export class DocxParser implements IParser {
  async parse(buffer: Buffer): Promise<Document> {
    // Extract raw text from the docx
    const result = await mammoth.extractRawText({ buffer });
    return {
      content: result.value,
      metadata: {
        messages: result.messages,
      },
    };
  }
}

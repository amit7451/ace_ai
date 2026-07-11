import { IParser, Document } from '../interfaces/parser.interface';

export class TxtParser implements IParser {
  async parse(buffer: Buffer): Promise<Document> {
    return {
      content: buffer.toString('utf-8'),
      metadata: {},
    };
  }
}

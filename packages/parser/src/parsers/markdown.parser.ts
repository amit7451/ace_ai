import { IParser, Document } from '../interfaces/parser.interface';
import { remark } from 'remark';
import stripHtml from 'remark-strip-html';

export class MarkdownParser implements IParser {
  async parse(buffer: Buffer): Promise<Document> {
    const markdownString = buffer.toString('utf-8');

    // Process markdown to strip any raw HTML that might be embedded
    const processed = await remark().use(stripHtml).process(markdownString);

    return {
      content: String(processed),
      metadata: {},
    };
  }
}

import { IParser, Document } from '../interfaces/parser.interface';
import * as cheerio from 'cheerio';

export class HtmlParser implements IParser {
  async parse(buffer: Buffer): Promise<Document> {
    const htmlString = buffer.toString('utf-8');
    const $ = cheerio.load(htmlString);

    // Remove script and style elements
    $('script, style, noscript, iframe, link, meta').remove();

    // Extract text from body or everything if no body
    const content = $('body').length ? $('body').text() : $.text();

    // Clean up excessive whitespace
    const cleanedContent = content.replace(/\s\s+/g, ' ').trim();

    return {
      content: cleanedContent,
      metadata: {
        title: $('title').text() || undefined,
      },
    };
  }
}

import { RawDocumentInput, ParsedDocument } from '../../types/knowledge-document.types';
import { BaseDocumentParser } from '../base/base-document-parser';
import { normalizeWhitespace } from '../../utils/text-cleaning';

const NAMED_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => NAMED_ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCharCode(parseInt(code, 16)));
}

/**
 * Regex-based tag stripping, not a full DOM parser. This is intentional: per
 * the architecture doc's crawler stack (Playwright, Cheerio, Readability),
 * the website crawler already runs Readability upstream to extract the main
 * article content before this layer ever sees it — this parser's job is
 * just turning that already-cleaned HTML into plain text, not surviving
 * arbitrary raw markup with heavy scripting/styling.
 */
export class HtmlParser extends BaseDocumentParser {
  readonly format = 'html' as const;

  protected rawParse(input: RawDocumentInput): ParsedDocument {
    let text = input.content
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr)\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');

    text = decodeHtmlEntities(text);
    return { text: normalizeWhitespace(text) };
  }
}

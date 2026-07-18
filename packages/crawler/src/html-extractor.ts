import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

export interface ExtractedPage {
  title: string;
  /** Lightly-structured Markdown (headings, paragraphs, lists, code blocks) — good input for ai-core's markdown-aware chunker, which keeps sections together by heading. */
  markdown: string;
}

/** Elements whose entire subtree is noise for RAG purposes and should never contribute text. */
const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'template',
  'nav',
  'footer',
  'header',
  'aside',
  'form',
  'iframe',
  'svg',
  'button',
  '[aria-hidden="true"]',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
];

/** Prefer a real "main content" container over the whole page when one exists, to skip nav/sidebar noise that NOISE_SELECTORS doesn't catch by tag name alone. */
function selectContentRoot($: cheerio.CheerioAPI) {
  for (const selector of ['main', 'article', '[role="main"]', '#content', '#main']) {
    const el = $(selector).first();
    if (el.length > 0) return el;
  }
  return $('body');
}

function collapseWhitespace(text: string): string {
  return text.replace(/[ \t]+/g, ' ').trim();
}

/** Recursively walks block-level elements, producing one Markdown-ish line (or blank line) per block. */
function walk($: cheerio.CheerioAPI, node: Element, lines: string[]): void {
  const tag = node.tagName?.toLowerCase();
  const $node = $(node);

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = Number(tag[1]);
      const text = collapseWhitespace($node.text());
      if (text) lines.push('', `${'#'.repeat(level)} ${text}`, '');
      return;
    }
    case 'p': {
      const text = collapseWhitespace($node.text());
      if (text) lines.push(text, '');
      return;
    }
    case 'li': {
      const text = collapseWhitespace($node.text());
      if (text) lines.push(`- ${text}`);
      return;
    }
    case 'ul':
    case 'ol': {
      $node.children('li').each((_, li) => walk($, li, lines));
      lines.push('');
      return;
    }
    case 'blockquote': {
      const text = collapseWhitespace($node.text());
      if (text) lines.push(`> ${text}`, '');
      return;
    }
    case 'pre': {
      const text = $node.text().trim();
      if (text) lines.push('```', text, '```', '');
      return;
    }
    case 'br': {
      lines.push('');
      return;
    }
    case 'tr': {
      const cells = $node
        .children('td, th')
        .map((_, cell) => collapseWhitespace($(cell).text()))
        .get()
        .filter(Boolean);
      if (cells.length > 0) lines.push(cells.join(' | '));
      return;
    }
    default: {
      // Container/inline element: capture any direct text nodes that aren't purely whitespace,
      // then recurse into child elements. This ensures we don't drop text just because it's
      // wrapped in a <div> or <span> instead of a <p>.
      $node.contents().each((_, child) => {
        if (child.type === 'text') {
          const text = collapseWhitespace($(child).text());
          if (text) lines.push(text, '');
        } else if (child.type === 'tag') {
          walk($, child as Element, lines);
        }
      });
    }
  }
}

/**
 * Converts a crawled HTML page into a title + clean, structure-preserving
 * Markdown body suitable for `ai-core`'s markdown-aware chunker. This is a
 * pragmatic content extractor (main/article detection + noise stripping +
 * heading-aware walk), not a full readability algorithm — good enough for
 * RAG ingestion without pulling in a large dependency.
 */
export function extractContent(html: string): ExtractedPage {
  const $ = cheerio.load(html);
  NOISE_SELECTORS.forEach((selector) => $(selector).remove());

  const title =
    collapseWhitespace($('title').first().text()) || collapseWhitespace($('h1').first().text());

  const root = selectContentRoot($);
  const lines: string[] = [];
  root.contents().each((_, node) => {
    if (node.type === 'tag') walk($, node as Element, lines);
  });

  const markdown = lines
    .join('\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { title: title || 'Untitled Page', markdown };
}

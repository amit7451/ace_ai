import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import * as cheerio from 'cheerio';
import { findPlatformContent } from './content/platform-extractors';
import { htmlToMarkdown } from './content/markdown-converter';
import { sanitizeExtractedText } from './content/sanitize-text';
import { detectClientRenderedShell } from './content/spa-detection';

export interface ExtractedPage {
  title: string;
  markdown: string;
  /** True when this extraction probably missed the page's real content because it needs JavaScript to render (React/Vue/Angular SPA shell, etc.) — see browser-fetch.ts for the fallback. */
  likelyNeedsJsRendering: boolean;
  jsRenderingReason?: string;
}

/**
 * Chrome that's noise regardless of what generated the page — removed
 * unconditionally, even from content Readability/a platform selector
 * already picked out (neither is perfect at every edge case: an ad iframe
 * or a "related posts" widget occasionally ends up inside the matched
 * container on real sites).
 */
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
  'dialog',
  '[aria-hidden="true"]',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[class*="cookie-banner"]',
  '[class*="cookie-consent"]',
  '[id*="cookie-consent"]',
  '[class*="cookie-notice"]',
  '[class*="newsletter-signup"]',
  '[class*="popup"]',
  '[class*="modal"]',
  '[class*="social-share"]',
  '[class*="share-buttons"]',
  '[class*="related-posts"]',
  '[class*="recommended-posts"]',
  '[class*="advertisement"]',
  '[class*="ad-container"]',
  '[id*="google_ads"]',
  '[class*="adsbygoogle"]',
  '#comments',
  '[class*="comment-section"]',
  '[class*="breadcrumb"]',
  '.skip-link',
  '.visually-hidden',
  '.sr-only',
];

/**
 * Extracts the main content of a crawled page as Title + clean Markdown,
 * working regardless of what tech stack produced the HTML. Three-tier
 * strategy, each tier a fallback for the one before it:
 *
 * 1. Known-platform selectors (WordPress, Docusaurus, MkDocs/Sphinx,
 *    GitBook, Ghost, Medium, Confluence, Zendesk, Notion, ...) — cheap to
 *    check, and cleaner than a generic scorer when they hit because
 *    they're targeted at exactly that platform's markup.
 * 2. Mozilla's Readability (the algorithm behind Firefox Reader View) —
 *    scores real DOM structure (text density, link density, class/id
 *    naming hints) rather than any framework's specific conventions, so it
 *    works on hand-built HTML, heavyweight CMS themes, and bespoke
 *    frameworks alike.
 * 3. Raw `<body>` with just NOISE_SELECTORS stripped — used only when
 *    neither of the above produced anything, which in practice mostly
 *    means the page is a near-empty client-rendered shell; see
 *    `likelyNeedsJsRendering` below for what to do about that.
 *
 * This function only ever looks at whatever HTML it's given — it has no
 * opinion on how that HTML was obtained. Call it once on the plain fetched
 * response; if `likelyNeedsJsRendering` comes back true and you have a
 * renderer available (browser-fetch.ts), re-fetch with that and call this
 * again on the rendered HTML.
 */
export function extractContent(html: string, pageUrl: string): ExtractedPage {
  const platformResult = findPlatformContent(html);

  let contentHtml: string | null = null;
  let title = '';

  if (platformResult) {
    contentHtml = platformResult.contentHtml;
    title = platformResult.title;
  } else {
    try {
      const dom = new JSDOM(html, { url: pageUrl });
      const reader = new Readability(dom.window.document, { charThreshold: 100 });
      const article = reader.parse();
      if (article?.content) {
        contentHtml = article.content;
        title = article.title || '';
      }
    } catch {
      // A page malformed enough to make Readability throw still deserves a
      // best-effort attempt via the raw-body fallback below rather than an
      // empty result.
    }
  }

  const $ = cheerio.load(contentHtml ?? html);
  NOISE_SELECTORS.forEach((selector) => $(selector).remove());

  if (!title) {
    title = $('title').first().text().trim() || $('h1').first().text().trim();
  }

  const root = contentHtml ? $.root() : $('body');
  const rawMarkdown = htmlToMarkdown($, root);
  let markdown = sanitizeExtractedText(rawMarkdown);

  // Readability (and some platform selectors) treat the page's own H1 as a
  // separate "title" and exclude it from `.content` — correct for a reader
  // view, but it means that heading's text (often the single most
  // topically-important string on the page) would otherwise vanish
  // entirely rather than just move to metadata. Restore it as the leading
  // line of the actual embedded content, unless the body already starts
  // with its own top-level heading (the common case for platform-selector
  // hits, where the H1 lives inside the matched container).
  const alreadyStartsWithHeading = /^#\s+\S/.test(markdown);
  if (!alreadyStartsWithHeading && title && title !== 'Untitled Page') {
    markdown = markdown ? `# ${title}\n\n${markdown}` : `# ${title}`;
  }

  const { looksClientRendered, reason } = detectClientRenderedShell(html, markdown.length);

  return {
    title: title || 'Untitled Page',
    markdown,
    likelyNeedsJsRendering: looksClientRendered,
    jsRenderingReason: reason,
  };
}

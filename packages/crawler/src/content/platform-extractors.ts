import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

export interface PlatformMatch {
  platform: string;
  contentHtml: string;
  title: string;
}

interface PlatformDefinition {
  name: string;
  /** Cheap sniff on the raw HTML/head, before any DOM walking — should be nearly free to check. */
  detect: ($: CheerioAPI, html: string) => boolean;
  /** Selectors tried in order; the first one that yields enough text wins. */
  contentSelectors: string[];
}

const MIN_TEXT_LENGTH = 150;

/**
 * Common CMS/doc-generator platforms have consistent-enough markup that a
 * targeted selector usually extracts more cleanly than a generic
 * readability-style scorer — no sidebar/TOC/version-switcher noise to
 * accidentally out-score the real content. This is tried first; anything
 * not on this list (which is most of the web — hand-built sites, bespoke
 * frameworks, etc.) falls through to Readability in html-extractor.ts, which
 * makes no assumptions about markup conventions at all.
 */
const PLATFORMS: PlatformDefinition[] = [
  {
    name: 'wordpress',
    detect: (_$, html) =>
      /generator["'][^>]*content=["'][^"']*WordPress/i.test(html) ||
      /wp-content|wp-json/.test(html),
    contentSelectors: [
      '.entry-content',
      '.post-content',
      'article .content',
      '#content .entry',
      'article',
    ],
  },
  {
    name: 'docusaurus',
    detect: ($, html) =>
      /generator["'][^>]*content=["'][^"']*Docusaurus/i.test(html) || $('#__docusaurus').length > 0,
    contentSelectors: ['article .theme-doc-markdown', 'main .markdown', 'article'],
  },
  {
    name: 'mkdocs-material',
    detect: ($, html) =>
      /generator["'][^>]*content=["'][^"']*mkdocs/i.test(html) || $('.md-content').length > 0,
    contentSelectors: ['.md-content__inner', '.md-content'],
  },
  {
    name: 'sphinx-readthedocs',
    detect: (_$) => _$('.rst-content').length > 0 || _$('div.document[role="main"]').length > 0,
    contentSelectors: ['.rst-content [role="main"]', '.rst-content', 'div.document[role="main"]'],
  },
  {
    name: 'gitbook',
    detect: ($, html) =>
      /generator["'][^>]*content=["'][^"']*GitBook/i.test(html) || $('.page-inner').length > 0,
    contentSelectors: ['.page-inner section', '.page-inner', 'main'],
  },
  {
    name: 'ghost',
    detect: (_$, html) => /generator["'][^>]*content=["'][^"']*Ghost/i.test(html),
    contentSelectors: ['.gh-content', '.post-content', 'article'],
  },
  {
    name: 'medium',
    detect: (_$, html) => /medium\.com|generator["'][^>]*content=["'][^"']*Medium/i.test(html),
    contentSelectors: ['article'],
  },
  {
    name: 'confluence',
    detect: ($) => $('#main-content').length > 0 && $('meta[name="ajs-base-url"]').length > 0,
    contentSelectors: ['#main-content'],
  },
  {
    name: 'zendesk-help-center',
    detect: ($) => $('.article-body').length > 0,
    contentSelectors: ['.article-body'],
  },
  {
    name: 'notion',
    detect: ($) => $('.notion-page-content').length > 0,
    contentSelectors: ['.notion-page-content'],
  },
];

export function findPlatformContent(html: string): PlatformMatch | null {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim();

  for (const platform of PLATFORMS) {
    let matches = false;
    try {
      matches = platform.detect($, html);
    } catch {
      continue;
    }
    if (!matches) continue;

    for (const selector of platform.contentSelectors) {
      const el = $(selector).first();
      if (el.length === 0) continue;
      const text = el.text().trim();
      if (text.length >= MIN_TEXT_LENGTH) {
        return { platform: platform.name, contentHtml: $.html(el), title };
      }
    }
  }

  return null;
}

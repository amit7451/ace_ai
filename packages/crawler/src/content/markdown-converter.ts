import type { CheerioAPI, Cheerio } from 'cheerio';
import type { AnyNode, Element } from 'domhandler';

/**
 * Serializes an element's inline content (text plus emphasis/code/links/
 * images inside a paragraph, heading, list item, or table cell) to Markdown.
 * This is deliberately separate from the block-level walker below: block
 * elements decide *where* a line break goes, this decides what the text on
 * that line actually looks like.
 *
 * Links are rendered as their text only, with the href dropped. That's a
 * deliberate choice, not an oversight: a paragraph with several inline
 * links turns into a paragraph with several bare URLs breaking up the
 * sentence, which is close to pure noise for an embedding model and does
 * nothing for retrieval quality. If a caller needs citations, extract hrefs
 * separately (see url-utils.ts's extractLinks) rather than inlining them
 * into the text that gets embedded.
 */
function serializeInline($: CheerioAPI, node: AnyNode): string {
  if (node.type === 'text') {
    return (node as any).data.replace(/\s+/g, ' ');
  }
  if (node.type !== 'tag') return '';

  const el = node as Element;
  const tag = el.tagName?.toLowerCase();
  const childText = () =>
    $(el)
      .contents()
      .toArray()
      .map((c) => serializeInline($, c))
      .join('');

  switch (tag) {
    case 'br':
      return '\n';
    case 'strong':
    case 'b': {
      const inner = childText().trim();
      return inner ? `**${inner}**` : '';
    }
    case 'em':
    case 'i': {
      const inner = childText().trim();
      return inner ? `*${inner}*` : '';
    }
    case 'del':
    case 's':
    case 'strike': {
      const inner = childText().trim();
      return inner ? `~~${inner}~~` : '';
    }
    case 'code': {
      const inner = $(el).text().trim();
      return inner ? `\`${inner}\`` : '';
    }
    case 'a':
      return childText();
    case 'img': {
      const alt = $(el).attr('alt')?.trim();
      // Empty/missing alt = decorative per HTML convention; skip entirely
      // rather than emitting a meaningless "[image]" placeholder.
      return alt ? ` [image: ${alt}] ` : '';
    }
    case 'script':
    case 'style':
    case 'button':
      return '';
    default:
      return childText();
  }
}

function textLine($: CheerioAPI, el: Element): string {
  return serializeInline($, el)
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function walkList($: CheerioAPI, listEl: Element, lines: string[], depth: number): void {
  const ordered = listEl.tagName?.toLowerCase() === 'ol';
  let index = 1;
  $(listEl)
    .children('li')
    .each((_, li) => {
      const $li = $(li);
      const nestedLists = $li.children('ul, ol');
      const $liOwnContent = $li.clone();
      $liOwnContent.children('ul, ol').remove();

      const text = textLine($, $liOwnContent.get(0) as Element);
      const indent = '  '.repeat(depth);
      const marker = ordered ? `${index}.` : '-';
      if (text) lines.push(`${indent}${marker} ${text}`);
      index++;

      nestedLists.each((_, nested) => walkList($, nested as Element, lines, depth + 1));
    });
}

/** Strips syntax-highlighter chrome (line-number gutters, copy buttons) that would otherwise interleave stray numerals/UI text into extracted code. */
function cleanCodeBlock($: CheerioAPI, preEl: Element): { code: string; language: string } {
  const $pre = $(preEl).clone();
  $pre
    .find(
      '.line-numbers-rows, .linenodiv, .gutter, [class*="line-number"], [aria-hidden="true"], button, .copy, [class*="copy-button"]'
    )
    .remove();

  const codeEl = $pre.find('code').first();
  const classAttr = (codeEl.attr('class') || $pre.attr('class') || '').split(/\s+/);
  const languageClass = classAttr.find((c) => /^(language-|lang-)/.test(c));
  const language = languageClass ? languageClass.replace(/^(language-|lang-)/, '') : '';

  const code = ($pre.text() || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd();
  return { code, language };
}

function walkTable($: CheerioAPI, tableEl: Element, lines: string[]): void {
  const rows: string[][] = [];
  $(tableEl)
    .find('tr')
    .each((_, tr) => {
      const cells = $(tr)
        .children('td, th')
        .map((_, cell) => textLine($, cell as Element) || ' ')
        .get();
      if (cells.length > 0) rows.push(cells);
    });

  if (rows.length === 0) return;

  const colCount = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => {
    const copy = [...r];
    while (copy.length < colCount) copy.push('');
    return copy;
  };

  lines.push('');
  const header = pad(rows[0]);
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`| ${header.map(() => '---').join(' | ')} |`);
  for (const row of rows.slice(1)) {
    lines.push(`| ${pad(row).join(' | ')} |`);
  }
  lines.push('');
}

function walkBlock($: CheerioAPI, node: Element, lines: string[]): void {
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
      const text = textLine($, node);
      if (text) lines.push('', `${'#'.repeat(level)} ${text}`, '');
      return;
    }
    case 'p': {
      const text = textLine($, node);
      if (text) lines.push(text, '');
      return;
    }
    case 'blockquote': {
      const text = textLine($, node);
      if (text) lines.push(...text.split('\n').map((l) => `> ${l}`), '');
      return;
    }
    case 'pre': {
      const { code, language } = cleanCodeBlock($, node);
      if (code) lines.push('', '```' + language, code, '```', '');
      return;
    }
    case 'ul':
    case 'ol': {
      walkList($, node, lines, 0);
      lines.push('');
      return;
    }
    case 'table': {
      walkTable($, node, lines);
      return;
    }
    case 'dl': {
      $node.children('dt, dd').each((_, child) => {
        const childTag = (child as Element).tagName?.toLowerCase();
        const text = textLine($, child as Element);
        if (!text) return;
        lines.push(childTag === 'dt' ? `\n**${text}**` : text);
      });
      lines.push('');
      return;
    }
    case 'hr': {
      lines.push('', '---', '');
      return;
    }
    case 'br': {
      lines.push('');
      return;
    }
    case 'li':
    case 'tr':
    case 'td':
    case 'th':
      // Handled by their owning `ul`/`ol`/`table` case above — reaching
      // here directly (not via that case) means there's no sensible
      // container, so just fall through to generic recursion below.
      $node.children().each((_, child) => walkBlock($, child as Element, lines));
      return;
    case 'script':
    case 'style':
    case 'noscript':
    case 'template':
      return;
    default: {
      // Generic container (div/section/span/article/etc.) — recurse into
      // element children. Bare text nodes directly under a container
      // without an enclosing <p> are intentionally not collected here;
      // real-world pages almost always wrap meaningful text in a block
      // element, and picking up stray text nodes tends to duplicate
      // content already captured by a sibling <p>/<span> more than it
      // adds anything.
      $node.children().each((_, child) => walkBlock($, child as Element, lines));
    }
  }
}

/** Converts a cheerio root/element's subtree into lightly-structured Markdown (headings, paragraphs, lists, tables, code blocks). */
export function htmlToMarkdown($: CheerioAPI, root: Cheerio<AnyNode>): string {
  const lines: string[] = [];
  root.contents().each((_, node) => {
    if (node.type === 'tag') walkBlock($, node as Element, lines);
  });

  return lines
    .join('\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

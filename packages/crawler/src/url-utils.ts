import * as cheerio from 'cheerio';

/**
 * Normalizes a URL for dedup purposes: lowercases the protocol/host, drops
 * the fragment (never sent to a server, so two URLs differing only by
 * `#section` are the same page), drops a default port, and removes a
 * trailing slash on non-root paths. Query strings are deliberately left
 * alone — they frequently denote genuinely distinct content (e.g.
 * `?page=2`), and silently merging them would drop real pages.
 */
export function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = '';
  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  ) {
    url.port = '';
  }
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

/** Strips a single leading "www." for comparison purposes only (never for storage/display). */
function stripWww(hostname: string): string {
  return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
}

/** True if `url` shares an origin with `seedUrl`, treating `example.com` and `www.example.com` as equivalent. */
export function isSameOrigin(url: string, seedUrl: string): boolean {
  const a = new URL(url);
  const b = new URL(seedUrl);
  return stripWww(a.hostname.toLowerCase()) === stripWww(b.hostname.toLowerCase());
}

/**
 * Minimal glob matcher for include/exclude path config: `*` matches any run
 * of characters except `/`, `**` matches any run of characters including
 * `/`. Patterns are matched against the URL's pathname only (not query
 * string), so `excludePaths: ['/admin/*']` behaves as you'd expect.
 */
export function matchesPathPattern(pathname: string, pattern: string): boolean {
  const escaped = pattern
    .split('')
    .map((ch) => (/[.+^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch))
    .join('')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(pathname);
}

export function matchesAnyPattern(pathname: string, patterns: string[] | undefined): boolean {
  if (!patterns || patterns.length === 0) return false;
  return patterns.some((p) => matchesPathPattern(pathname, p));
}

/**
 * Extracts absolute, http(s)-only, deduplicated link targets from an HTML
 * page's `<a href>` attributes, resolved against `baseUrl`. Skips
 * `mailto:`, `tel:`, `javascript:`, and pure same-page fragment links.
 */
export function extractLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    if (/^(mailto|tel|javascript|data):/i.test(trimmed)) return;

    let resolved: URL;
    try {
      resolved = new URL(trimmed, baseUrl);
    } catch {
      return;
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return;

    const normalized = normalizeUrl(resolved.toString());
    if (!seen.has(normalized)) {
      seen.add(normalized);
      links.push(normalized);
    }
  });

  return links;
}

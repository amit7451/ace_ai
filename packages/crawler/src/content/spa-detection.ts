export interface SpaDetectionResult {
  looksClientRendered: boolean;
  reason?: string;
}

/** Framework-specific fingerprints, checked only once extracted text is already suspiciously thin. */
const CSR_FINGERPRINTS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /id=["']root["']/, name: 'React root mount (id="root")' },
  { pattern: /id=["']app["']/, name: 'Vue/generic SPA root mount (id="app")' },
  { pattern: /data-reactroot/, name: 'React (data-reactroot)' },
  { pattern: /ng-version=/, name: 'Angular (ng-version attribute)' },
  { pattern: /data-server-rendered=["']false["']/, name: 'Vue with SSR explicitly disabled' },
  { pattern: /window\.__NUXT__/, name: 'Nuxt client hydration payload' },
  {
    pattern: /data-docsify/,
    name: 'Docsify (renders Markdown client-side from an id="app" shell)',
  },
];

const MIN_TEXT_LENGTH = 200;
const NEARLY_EMPTY_LENGTH = 40;
const MAX_SCRIPT_BYTE_RATIO = 0.6;

/**
 * Decides whether a page's static HTML is probably an unrendered SPA shell
 * rather than a genuinely short page. Two independent signals, checked only
 * when the extracted text is already thin (a normal short page — a simple
 * contact page, say — shouldn't get flagged just because it's short):
 *
 * 1. Known root-mount fingerprints (React/Vue/Angular/Nuxt/Docsify) — high
 *    precision when present, but framework-specific.
 * 2. A page dominated by <script> bytes relative to total HTML size — a
 *    framework-agnostic signal that catches bespoke/uncommon SPA setups
 *    fingerprint matching would miss entirely.
 *
 * If extracted text clears MIN_TEXT_LENGTH, the page is assumed to already
 * be server-rendered (or SSG'd) regardless of which framework it happens to
 * use — Next.js/Nuxt/SvelteKit/Astro in SSR/SSG mode all produce plenty of
 * real text in the initial response and shouldn't trigger a browser render
 * just because `id="__next"` or similar happens to be present.
 */
export function detectClientRenderedShell(
  html: string,
  extractedTextLength: number
): SpaDetectionResult {
  if (extractedTextLength >= MIN_TEXT_LENGTH) {
    return { looksClientRendered: false };
  }

  for (const { pattern, name } of CSR_FINGERPRINTS) {
    if (pattern.test(html)) {
      return {
        looksClientRendered: true,
        reason: `Only ${extractedTextLength} chars of text extracted, and the page fingerprints as ${name} — likely needs JS to render its real content.`,
      };
    }
  }

  const scriptBytes = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].reduce(
    (sum, m) => sum + m[0].length,
    0
  );
  const scriptRatio = html.length > 0 ? scriptBytes / html.length : 0;
  if (html.length > 500 && scriptRatio > MAX_SCRIPT_BYTE_RATIO) {
    return {
      looksClientRendered: true,
      reason: `Only ${extractedTextLength} chars of text extracted, and ${Math.round(
        scriptRatio * 100
      )}% of the page is <script> content — likely a client-rendered app regardless of framework.`,
    };
  }

  if (extractedTextLength < NEARLY_EMPTY_LENGTH) {
    return {
      looksClientRendered: true,
      reason: `Almost no extractable text (${extractedTextLength} chars) and no specific framework fingerprint matched — worth trying a rendered fetch regardless.`,
    };
  }

  return { looksClientRendered: false };
}

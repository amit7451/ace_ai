/**
 * Final cleanup pass applied to extracted Markdown before it's handed off
 * for chunking/embedding. Two distinct problems this solves:
 *
 * 1. Whitespace/encoding noise that survives HTML parsing no matter what
 *    generated the page (non-breaking spaces, zero-width characters, runs
 *    of blank lines from stripped elements).
 * 2. Unevaluated template syntax. A page fetched as static HTML but meant
 *    to be hydrated client-side (Vue/Angular/Handlebars-style templates)
 *    can still contain literal `{{ user.name }}`-style expressions that
 *    were never evaluated — static extraction has no way to know these
 *    "aren't real text" other than pattern-matching the syntax itself. The
 *    real fix is rendering the page first (browser-fetch.ts); this is a
 *    cheap safety net for whatever slips through regardless.
 */
export function sanitizeExtractedText(input: string): string {
  let text = input;

  // Zero-width characters and non-breaking spaces.
  text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
  text = text.replace(/\u00A0/g, ' ');

  // Unevaluated template expressions that occasionally leak through as
  // literal text: Mustache/Handlebars/Vue/Angular `{{ }}`, Django/Jinja/
  // Liquid `{% %}`, EJS/ERB `<% %>`.
  text = text.replace(/\{\{[^{}]{0,200}\}\}/g, '');
  text = text.replace(/\{%[^{}]{0,200}%\}/g, '');
  text = text.replace(/<%[^%]{0,200}%>/g, '');

  // Collapse whitespace noise without destroying intentional line/paragraph breaks.
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

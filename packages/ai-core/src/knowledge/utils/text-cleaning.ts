/**
 * Normalizes line endings, collapses repeated horizontal whitespace,
 * trims trailing whitespace per line, and caps blank-line runs at one
 * blank line (two consecutive newlines) so downstream chunking sees
 * consistent, compact text regardless of source formatting quirks.
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

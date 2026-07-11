// A short, curated list of common abbreviations that end in a period but do
// not end a sentence. Not exhaustive — this is a lightweight heuristic used
// as one level of the recursive splitter's fallback chain, not a full NLP
// sentence tokenizer. Missing an abbreviation just means an extra sentence
// boundary gets inserted where a human wouldn't — harmless for chunking
// purposes, since chunks are merged back up to `maxChunkSize` regardless.
const ABBREVIATION_BEFORE_BOUNDARY =
  /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|St|No|Vol|Fig)\.$/i;

/**
 * Splits text into sentences on '.', '!', or '?' followed by whitespace (or
 * end of string), skipping boundaries that immediately follow a known
 * abbreviation. Used by `splitRecursively` as a mid-level fallback between
 * line breaks and raw words.
 */
export function splitIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  const boundaryRegex = /[.!?]+["')\]]?(\s+|$)/g;
  let start = 0;
  let match: RegExpExecArray | null;

  while ((match = boundaryRegex.exec(text)) !== null) {
    const end = match.index + match[0].length;
    const textBeforeBoundary = text.slice(start, match.index + 1).trim();

    if (ABBREVIATION_BEFORE_BOUNDARY.test(textBeforeBoundary)) {
      continue;
    }

    sentences.push(text.slice(start, end).trim());
    start = end;
  }

  if (start < text.length) {
    const remainder = text.slice(start).trim();
    if (remainder) sentences.push(remainder);
  }

  return sentences.filter((s) => s.length > 0);
}

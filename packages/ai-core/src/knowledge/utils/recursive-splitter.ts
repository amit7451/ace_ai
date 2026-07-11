import { splitIntoSentences } from './sentence-splitter';

type SeparatorLevel = 'paragraph' | 'line' | 'sentence' | 'word';

const SEPARATOR_LEVELS: SeparatorLevel[] = ['paragraph', 'line', 'sentence', 'word'];

/** Canonical separator re-inserted between two units that were split at this level, when they're merged back into the same output chunk. */
const JOIN_SEPARATOR: Record<SeparatorLevel, string> = {
  paragraph: '\n\n',
  line: '\n',
  sentence: ' ',
  // word-level splitting keeps each unit's own trailing whitespace (see the lookahead below), so no extra separator is inserted.
  word: '',
};

function splitBySeparatorLevel(text: string, level: SeparatorLevel): string[] {
  switch (level) {
    case 'paragraph':
      return text.split(/\n\s*\n/);
    case 'line':
      return text.split('\n');
    case 'sentence':
      return splitIntoSentences(text);
    case 'word':
      // Split right after each run of whitespace, so whitespace stays attached to the word that precedes it and rejoining with '' reconstructs the original spacing.
      return text.split(/(?<=\s)/);
  }
}

interface SplitUnit {
  text: string;
  /** Separator to insert before this unit, if it's appended after a previous unit while merging into one output chunk. */
  joinSeparator: string;
}

function hardSlice(text: string, maxChunkSize: number): SplitUnit[] {
  const units: SplitUnit[] = [];
  for (let i = 0; i < text.length; i += maxChunkSize) {
    units.push({ text: text.slice(i, i + maxChunkSize), joinSeparator: '' });
  }
  return units;
}

function recursiveSplitToUnits(
  text: string,
  levelIndex: number,
  maxChunkSize: number
): SplitUnit[] {
  if (text.length <= maxChunkSize) {
    return [{ text, joinSeparator: '' }];
  }
  if (levelIndex >= SEPARATOR_LEVELS.length) {
    // Every natural separator has been tried and this piece is still too large (e.g. one enormous "word") — hard-slice as a last resort.
    return hardSlice(text, maxChunkSize);
  }

  const level = SEPARATOR_LEVELS[levelIndex];
  const rawParts = splitBySeparatorLevel(text, level).filter((p) => p.length > 0);

  if (rawParts.length <= 1) {
    // This separator didn't actually divide the text (e.g. no blank lines present) — move straight to the next, finer-grained level.
    return recursiveSplitToUnits(text, levelIndex + 1, maxChunkSize);
  }

  const units: SplitUnit[] = [];
  rawParts.forEach((part, i) => {
    const joinSeparator = i === 0 ? '' : JOIN_SEPARATOR[level];
    if (part.length <= maxChunkSize) {
      units.push({ text: part, joinSeparator });
      return;
    }
    const subUnits = recursiveSplitToUnits(part, levelIndex + 1, maxChunkSize);
    subUnits.forEach((sub, j) => {
      // Only the first sub-unit inherits this level's join separator (it's still the boundary between the previous sibling and this part); later sub-units keep whatever separator their own split level produced.
      units.push({ text: sub.text, joinSeparator: j === 0 ? joinSeparator : sub.joinSeparator });
    });
  });

  return units;
}

function mergeUnitsWithOverlap(
  units: SplitUnit[],
  maxChunkSize: number,
  chunkOverlap: number
): string[] {
  const chunks: string[] = [];
  let current = '';

  for (const unit of units) {
    const separator = current === '' ? '' : unit.joinSeparator;
    const candidate = current + separator + unit.text;

    if (candidate.length <= maxChunkSize) {
      current = candidate;
      continue;
    }

    if (current !== '') {
      chunks.push(current);
      const overlapTail = chunkOverlap > 0 ? current.slice(-chunkOverlap) : '';
      const withOverlap = overlapTail ? overlapTail + separator + unit.text : unit.text;
      current = withOverlap.length <= maxChunkSize ? withOverlap : unit.text.slice(0, maxChunkSize);
    } else {
      // A single unit already exceeds maxChunkSize on its own — shouldn't happen given the recursion above guarantees unit.text.length <= maxChunkSize, but guard defensively.
      current = unit.text.slice(0, maxChunkSize);
    }
  }

  if (current !== '') chunks.push(current);
  return chunks;
}

/**
 * Recursively splits `text` into pieces no larger than `maxChunkSize`,
 * preferring to break on paragraph boundaries, then lines, then sentences,
 * then words, hard-slicing only if nothing else gets a piece under the
 * limit. Adjacent output chunks share the last `chunkOverlap` characters of
 * context for retrieval continuity across a chunk boundary.
 */
export function splitRecursively(
  text: string,
  maxChunkSize: number,
  chunkOverlap: number
): string[] {
  if (text.trim().length === 0) return [];
  const units = recursiveSplitToUnits(text, 0, maxChunkSize);
  return mergeUnitsWithOverlap(units, maxChunkSize, chunkOverlap);
}

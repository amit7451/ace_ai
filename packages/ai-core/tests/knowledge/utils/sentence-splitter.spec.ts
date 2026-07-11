import { splitIntoSentences } from '../../../src/knowledge/utils/sentence-splitter';

describe('splitIntoSentences', () => {
  it('splits on periods, question marks, and exclamation points', () => {
    expect(splitIntoSentences('One. Two? Three!')).toEqual(['One.', 'Two?', 'Three!']);
  });

  it('does not split on a period following a known abbreviation', () => {
    const result = splitIntoSentences('Contact Dr. Smith for details. He is available Monday.');
    expect(result).toEqual(['Contact Dr. Smith for details.', 'He is available Monday.']);
  });

  it('handles a trailing sentence with no terminal punctuation', () => {
    expect(splitIntoSentences('First sentence. Trailing fragment')).toEqual([
      'First sentence.',
      'Trailing fragment',
    ]);
  });

  it('returns an empty array for empty input', () => {
    expect(splitIntoSentences('')).toEqual([]);
  });

  it('keeps closing quotes/parens attached to the preceding punctuation', () => {
    expect(splitIntoSentences('She said "hello." Then left.')).toEqual([
      'She said "hello."',
      'Then left.',
    ]);
  });
});

import { normalizeWhitespace } from '../../../src/knowledge/utils/text-cleaning';

describe('normalizeWhitespace', () => {
  it('converts CRLF and CR line endings to LF', () => {
    expect(normalizeWhitespace('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('collapses repeated horizontal whitespace to a single space', () => {
    expect(normalizeWhitespace('a    b\t\tc')).toBe('a b c');
  });

  it('trims trailing whitespace from each line', () => {
    expect(normalizeWhitespace('line one   \nline two\t')).toBe('line one\nline two');
  });

  it('caps runs of 3+ blank lines down to one blank line', () => {
    expect(normalizeWhitespace('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('trims leading/trailing whitespace from the whole string', () => {
    expect(normalizeWhitespace('  \n hello \n  ')).toBe('hello');
  });
});

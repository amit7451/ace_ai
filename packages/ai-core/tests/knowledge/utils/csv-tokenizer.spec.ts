import { parseCsv } from '../../../src/knowledge/utils/csv-tokenizer';

describe('parseCsv', () => {
  it('parses simple comma-separated rows', () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    expect(parseCsv(csv)).toEqual([
      ['name', 'age'],
      ['Alice', '30'],
      ['Bob', '25'],
    ]);
  });

  it('handles quoted fields containing commas', () => {
    const csv = 'name,bio\nAlice,"Loves coffee, tea, and books"';
    expect(parseCsv(csv)).toEqual([
      ['name', 'bio'],
      ['Alice', 'Loves coffee, tea, and books'],
    ]);
  });

  it('handles quoted fields containing newlines', () => {
    const csv = 'name,bio\nAlice,"Line one\nLine two"';
    expect(parseCsv(csv)).toEqual([
      ['name', 'bio'],
      ['Alice', 'Line one\nLine two'],
    ]);
  });

  it('handles escaped double quotes inside a quoted field', () => {
    const csv = 'name,quote\nAlice,"She said ""hi"" to me"';
    expect(parseCsv(csv)).toEqual([
      ['name', 'quote'],
      ['Alice', 'She said "hi" to me'],
    ]);
  });

  it('handles CRLF line endings', () => {
    const csv = 'a,b\r\n1,2\r\n3,4';
    expect(parseCsv(csv)).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('handles a trailing newline without producing a phantom empty row', () => {
    const csv = 'a,b\n1,2\n';
    expect(parseCsv(csv)).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles a file with no trailing newline', () => {
    const csv = 'a,b\n1,2';
    expect(parseCsv(csv)).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

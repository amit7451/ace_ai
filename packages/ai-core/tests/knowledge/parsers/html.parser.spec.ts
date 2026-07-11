import { HtmlParser } from '../../../src/knowledge/parsers/html/html.parser';

describe('HtmlParser', () => {
  const parser = new HtmlParser();

  it('strips tags down to plain text', () => {
    const result = parser.parse({ content: '<div><p>Hello <b>world</b></p></div>' });
    expect(result.text).toBe('Hello world');
  });

  it('removes script and style block contents entirely', () => {
    const result = parser.parse({
      content:
        '<html><head><style>.a{color:red}</style></head><body><script>alert(1)</script><p>Real content</p></body></html>',
    });
    expect(result.text).toBe('Real content');
  });

  it('removes HTML comments', () => {
    const result = parser.parse({
      content: '<p>Visible</p><!-- hidden comment --><p>Also visible</p>',
    });
    expect(result.text).toBe('Visible\nAlso visible');
  });

  it('converts block-level closing tags into newlines', () => {
    const result = parser.parse({ content: '<p>First</p><p>Second</p>' });
    expect(result.text).toBe('First\nSecond');
  });

  it('decodes common named HTML entities', () => {
    const result = parser.parse({ content: '<p>Tom &amp; Jerry &lt;3 &quot;friends&quot;</p>' });
    expect(result.text).toBe('Tom & Jerry <3 "friends"');
  });

  it('decodes numeric and hex HTML entities', () => {
    const result = parser.parse({ content: '<p>&#65;&#66; and &#x43;&#x44;</p>' });
    expect(result.text).toBe('AB and CD');
  });

  it('reports its format', () => {
    expect(parser.format).toBe('html');
  });
});

import { extractContent } from '../src/html-extractor';

describe('extractContent', () => {
  it('extracts the title from <title>', () => {
    const html = `<html><head><title>Pricing — Acme</title></head><body><main><p>Hello</p></main></body></html>`;
    expect(extractContent(html).title).toBe('Pricing — Acme');
  });

  it('falls back to the first <h1> when there is no <title>', () => {
    const html = `<html><body><main><h1>Welcome</h1><p>Hello</p></main></body></html>`;
    expect(extractContent(html).title).toBe('Welcome');
  });

  it('strips script, style, nav, header, and footer content entirely', () => {
    const html = `
      <html><body>
        <nav>Home | About | Contact</nav>
        <header>Site Header Junk</header>
        <script>trackPageView();</script>
        <style>.a { color: red }</style>
        <main><p>The real content.</p></main>
        <footer>Copyright 2026</footer>
      </body></html>
    `;
    const { markdown } = extractContent(html);
    expect(markdown).toContain('The real content.');
    expect(markdown).not.toContain('Home | About | Contact');
    expect(markdown).not.toContain('trackPageView');
    expect(markdown).not.toContain('color: red');
    expect(markdown).not.toContain('Copyright 2026');
  });

  it('prefers <main> content over the rest of the page', () => {
    const html = `
      <html><body>
        <aside>Sidebar noise</aside>
        <main><p>Main content only.</p></main>
      </body></html>
    `;
    const { markdown } = extractContent(html);
    expect(markdown).toContain('Main content only.');
    expect(markdown).not.toContain('Sidebar noise');
  });

  it('converts headings to Markdown heading syntax at the right level', () => {
    const html = `<html><body><main><h1>Title</h1><h2>Subtitle</h2><p>Body text.</p></main></body></html>`;
    const { markdown } = extractContent(html);
    expect(markdown).toContain('# Title');
    expect(markdown).toContain('## Subtitle');
  });

  it('converts list items to Markdown bullets', () => {
    const html = `<html><body><main><ul><li>First</li><li>Second</li></ul></main></body></html>`;
    const { markdown } = extractContent(html);
    expect(markdown).toContain('- First');
    expect(markdown).toContain('- Second');
  });

  it('wraps <pre> content in a fenced code block', () => {
    const html = `<html><body><main><pre>const x = 1;</pre></main></body></html>`;
    const { markdown } = extractContent(html);
    expect(markdown).toContain('```');
    expect(markdown).toContain('const x = 1;');
  });

  it('collapses excessive blank lines', () => {
    const html = `<html><body><main><p>A</p><p></p><p></p><p>B</p></main></body></html>`;
    const { markdown } = extractContent(html);
    expect(markdown).not.toMatch(/\n{3,}/);
  });

  it('returns a fallback title when nothing is found', () => {
    const html = `<html><body><main><p>No title anywhere.</p></main></body></html>`;
    expect(extractContent(html).title).toBe('Untitled Page');
  });
});

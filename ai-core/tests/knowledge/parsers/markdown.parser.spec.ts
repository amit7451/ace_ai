import { MarkdownParser } from '../../../src/knowledge/parsers/markdown/markdown.parser';

describe('MarkdownParser', () => {
  const parser = new MarkdownParser();

  it('treats a document with no headers as one headerless section', () => {
    const result = parser.parse({ content: 'Just a plain paragraph with **bold** text.' });
    expect(result.structure?.markdownSections).toHaveLength(1);
    expect(result.structure?.markdownSections?.[0].headerPath).toEqual([]);
    expect(result.structure?.markdownSections?.[0].content).toBe('Just a plain paragraph with bold text.');
  });

  it('builds a header breadcrumb for nested headers', () => {
    const content = ['# Getting Started', 'Intro text.', '', '## Installation', 'Run npm install.'].join('\n');
    const result = parser.parse({ content });
    const sections = result.structure!.markdownSections!;
    expect(sections).toHaveLength(2);
    expect(sections[0].headerPath).toEqual(['Getting Started']);
    expect(sections[0].content).toBe('Intro text.');
    expect(sections[1].headerPath).toEqual(['Getting Started', 'Installation']);
    expect(sections[1].content).toBe('Run npm install.');
  });

  it('pops the breadcrumb stack back down for a sibling header', () => {
    const content = ['# Section A', '## Sub A1', 'content a1', '# Section B', 'content b'].join('\n');
    const result = parser.parse({ content });
    const sections = result.structure!.markdownSections!;
    const sectionB = sections.find((s) => s.content === 'content b');
    expect(sectionB?.headerPath).toEqual(['Section B']);
  });

  it('captures headerless intro content before the first header', () => {
    const content = ['Intro paragraph before any header.', '', '# First Header', 'Body.'].join('\n');
    const result = parser.parse({ content });
    const sections = result.structure!.markdownSections!;
    expect(sections[0].headerPath).toEqual([]);
    expect(sections[0].content).toBe('Intro paragraph before any header.');
  });

  it('strips common markdown syntax down to plain text', () => {
    const content = 'Check [our docs](https://example.com) and `inline code` and *italic* and **bold**.';
    const result = parser.parse({ content });
    expect(result.text).toBe('Check our docs and inline code and italic and bold.');
  });

  it('strips list markers and blockquotes', () => {
    const content = ['- item one', '- item two', '> a quote'].join('\n');
    const result = parser.parse({ content });
    expect(result.text).toContain('item one');
    expect(result.text).toContain('item two');
    expect(result.text).toContain('a quote');
    expect(result.text).not.toContain('- item');
    expect(result.text).not.toContain('>');
  });

  it('keeps code fence content but drops the fence markers', () => {
    const content = ['```', 'const x = 1;', '```'].join('\n');
    const result = parser.parse({ content });
    expect(result.text).toContain('const x = 1;');
    expect(result.text).not.toContain('```');
  });

  it('drops sections that end up with no body content', () => {
    const content = ['# Empty Header', '## Another Empty', '# Real Header', 'Some real content.'].join('\n');
    const result = parser.parse({ content });
    const sections = result.structure!.markdownSections!;
    expect(sections).toHaveLength(1);
    expect(sections[0].content).toBe('Some real content.');
  });
});

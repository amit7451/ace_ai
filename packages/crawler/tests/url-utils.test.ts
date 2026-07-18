import {
  normalizeUrl,
  isSameOrigin,
  matchesPathPattern,
  matchesAnyPattern,
  extractLinks,
} from '../src/url-utils';

describe('normalizeUrl', () => {
  it('strips the fragment', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page');
  });

  it('strips a default port', () => {
    expect(normalizeUrl('https://example.com:443/page')).toBe('https://example.com/page');
    expect(normalizeUrl('http://example.com:80/page')).toBe('http://example.com/page');
  });

  it('keeps a non-default port', () => {
    expect(normalizeUrl('http://example.com:8080/page')).toBe('http://example.com:8080/page');
  });

  it('removes a trailing slash on non-root paths', () => {
    expect(normalizeUrl('https://example.com/blog/')).toBe('https://example.com/blog');
  });

  it('keeps the root path slash', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
  });

  it('lowercases the hostname', () => {
    expect(normalizeUrl('https://ExAmple.COM/Page')).toBe('https://example.com/Page');
  });

  it('leaves the query string untouched', () => {
    expect(normalizeUrl('https://example.com/search?q=Hello&page=2')).toBe(
      'https://example.com/search?q=Hello&page=2'
    );
  });
});

describe('isSameOrigin', () => {
  it('treats identical hostnames as same origin', () => {
    expect(isSameOrigin('https://example.com/a', 'https://example.com/b')).toBe(true);
  });

  it('treats www. and bare domain as equivalent', () => {
    expect(isSameOrigin('https://www.example.com/a', 'https://example.com/b')).toBe(true);
    expect(isSameOrigin('https://example.com/a', 'https://www.example.com/b')).toBe(true);
  });

  it('rejects a different subdomain', () => {
    expect(isSameOrigin('https://shop.example.com/a', 'https://example.com/b')).toBe(false);
  });

  it('rejects a different registrable domain', () => {
    expect(isSameOrigin('https://evil.com/a', 'https://example.com/b')).toBe(false);
  });
});

describe('matchesPathPattern', () => {
  it('matches a single-segment wildcard', () => {
    expect(matchesPathPattern('/blog/hello-world', '/blog/*')).toBe(true);
    expect(matchesPathPattern('/blog/2024/hello', '/blog/*')).toBe(false);
  });

  it('matches a multi-segment wildcard', () => {
    expect(matchesPathPattern('/docs/2024/hello', '/docs/**')).toBe(true);
    expect(matchesPathPattern('/docs', '/docs/**')).toBe(false);
  });

  it('matches an exact path', () => {
    expect(matchesPathPattern('/pricing', '/pricing')).toBe(true);
    expect(matchesPathPattern('/pricing/enterprise', '/pricing')).toBe(false);
  });

  it('escapes regex special characters in the pattern', () => {
    expect(matchesPathPattern('/a.b', '/a.b')).toBe(true);
    expect(matchesPathPattern('/aXb', '/a.b')).toBe(false);
  });
});

describe('matchesAnyPattern', () => {
  it('returns false for an empty or undefined pattern list', () => {
    expect(matchesAnyPattern('/anything', [])).toBe(false);
    expect(matchesAnyPattern('/anything', undefined)).toBe(false);
  });

  it('returns true if any pattern matches', () => {
    expect(matchesAnyPattern('/admin/users', ['/blog/*', '/admin/**'])).toBe(true);
  });
});

describe('extractLinks', () => {
  const html = `
    <html><body>
      <a href="/about">About</a>
      <a href="https://example.com/pricing">Pricing</a>
      <a href="https://external.com/page">External</a>
      <a href="#top">Top</a>
      <a href="mailto:hi@example.com">Email</a>
      <a href="tel:+15555555555">Call</a>
      <a href="javascript:void(0)">JS</a>
      <a href="/about">About Again</a>
    </body></html>
  `;

  it('resolves relative links against the base URL', () => {
    const links = extractLinks(html, 'https://example.com/home');
    expect(links).toContain('https://example.com/about');
  });

  it('keeps absolute http(s) links', () => {
    const links = extractLinks(html, 'https://example.com/home');
    expect(links).toContain('https://example.com/pricing');
    expect(links).toContain('https://external.com/page');
  });

  it('skips mailto, tel, javascript, and fragment-only links', () => {
    const links = extractLinks(html, 'https://example.com/home');
    expect(links.some((l) => l.startsWith('mailto:'))).toBe(false);
    expect(links.some((l) => l.startsWith('tel:'))).toBe(false);
    expect(links.some((l) => l.startsWith('javascript:'))).toBe(false);
    expect(links.some((l) => l.includes('#top'))).toBe(false);
  });

  it('deduplicates repeated links', () => {
    const links = extractLinks(html, 'https://example.com/home');
    const aboutCount = links.filter((l) => l === 'https://example.com/about').length;
    expect(aboutCount).toBe(1);
  });
});

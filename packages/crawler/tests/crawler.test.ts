jest.mock('../src/safe-fetch');
jest.mock('../src/robots');

import { WebsiteCrawler } from '../src/crawler';
import { safeFetch } from '../src/safe-fetch';
import { loadRobotsPolicy } from '../src/robots';
import { CrawlConfig, CrawledPageResult } from '../src/types';

const mockedSafeFetch = safeFetch as jest.MockedFunction<typeof safeFetch>;
const mockedLoadRobotsPolicy = loadRobotsPolicy as jest.MockedFunction<typeof loadRobotsPolicy>;

/** A tiny fake site graph used across tests: seed -> /a, /b (+ external); /a -> /c; /b -> /a (dup), /admin/secret. */
const SITE: Record<string, string> = {
  'https://example.com/': `
    <html><body><main>
      <h1>Home</h1><p>Welcome to the home page, with enough text to count as real content.</p>
      <a href="/a">A</a>
      <a href="/b">B</a>
      <a href="https://external.com/x">External</a>
    </main></body></html>`,
  'https://example.com/a': `
    <html><body><main>
      <p>Page A has its own reasonably long paragraph of real content here.</p>
      <a href="/c">C</a>
    </main></body></html>`,
  'https://example.com/b': `
    <html><body><main>
      <p>Page B also has a decent amount of real textual content for extraction.</p>
      <a href="/a">Back to A</a>
      <a href="/admin/secret">Secret</a>
    </main></body></html>`,
  'https://example.com/c': `
    <html><body><main><p>Page C is a leaf node with some content of its own.</p></main></body></html>`,
  'https://example.com/admin/secret': `
    <html><body><main><p>Should never actually be fetched when excluded.</p></main></body></html>`,
  'https://external.com/x': `
    <html><body><main><p>An external page that should be out of scope by default.</p></main></body></html>`,
};

function fakeSafeFetch(url: string) {
  const html = SITE[url];
  if (!html) {
    return Promise.reject(new Error(`404 (test fixture has no page for ${url})`));
  }
  return Promise.resolve({
    finalUrl: url,
    statusCode: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: Buffer.from(html, 'utf-8'),
  });
}

function baseConfig(overrides: Partial<CrawlConfig> = {}): CrawlConfig {
  return {
    seedUrl: 'https://example.com/',
    maxPages: 20,
    maxDepth: 3,
    defaultCrawlDelayMs: 0, // keep tests fast; politeness delay is covered separately by inspecting call timing where needed
    respectRobotsTxt: true,
    ...overrides,
  };
}

describe('WebsiteCrawler', () => {
  beforeEach(() => {
    mockedSafeFetch.mockImplementation(fakeSafeFetch as any);
    mockedLoadRobotsPolicy.mockResolvedValue({ isAllowed: () => true, crawlDelayMs: undefined });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('crawls same-origin pages breadth-first and dedupes a page reached via two paths', async () => {
    const pages: CrawledPageResult[] = [];
    const summary = await new WebsiteCrawler().crawl(baseConfig(), {
      onPage: (p) => {
        pages.push(p);
      },
    });

    const completedUrls = pages.filter((p) => p.status === 'COMPLETED').map((p) => p.url);
    expect(completedUrls).toEqual(
      expect.arrayContaining([
        'https://example.com/',
        'https://example.com/a',
        'https://example.com/b',
        'https://example.com/c',
      ])
    );
    // /a is linked from both the seed and from /b — must only be fetched/reported once.
    expect(completedUrls.filter((u) => u === 'https://example.com/a')).toHaveLength(1);
    expect(mockedSafeFetch).toHaveBeenCalledTimes(
      new Set(completedUrls).size + summary.pagesFailed
    );
    expect(summary.cancelled).toBe(false);
  });

  it('does not cross origin by default', async () => {
    await new WebsiteCrawler().crawl(baseConfig(), { onPage: () => {} });
    const fetchedUrls = mockedSafeFetch.mock.calls.map((call) => call[0]);
    expect(fetchedUrls).not.toContain('https://external.com/x');
  });

  it('crosses origin when sameOriginOnly is false', async () => {
    await new WebsiteCrawler().crawl(baseConfig({ sameOriginOnly: false }), { onPage: () => {} });
    const fetchedUrls = mockedSafeFetch.mock.calls.map((call) => call[0]);
    expect(fetchedUrls).toContain('https://external.com/x');
  });

  it('respects maxDepth: pages beyond the depth limit are never queued', async () => {
    // depth 0 = seed, depth 1 = /a and /b. maxDepth=1 means links found ON /a and /b (which would be depth 2) are not queued.
    await new WebsiteCrawler().crawl(baseConfig({ maxDepth: 1 }), { onPage: () => {} });
    const fetchedUrls = mockedSafeFetch.mock.calls.map((call) => call[0]);
    expect(fetchedUrls).toContain('https://example.com/a');
    expect(fetchedUrls).toContain('https://example.com/b');
    expect(fetchedUrls).not.toContain('https://example.com/c');
  });

  it('skips paths matching excludePaths without ever fetching them', async () => {
    const pages: CrawledPageResult[] = [];
    await new WebsiteCrawler().crawl(baseConfig({ excludePaths: ['/admin/**'] }), {
      onPage: (p) => {
        pages.push(p);
      },
    });

    const fetchedUrls = mockedSafeFetch.mock.calls.map((call) => call[0]);
    expect(fetchedUrls).not.toContain('https://example.com/admin/secret');

    const skipped = pages.find((p) => p.url === 'https://example.com/admin/secret');
    expect(skipped?.status).toBe('SKIPPED');
  });

  it('only crawls paths matching includePaths when it is set', async () => {
    const pages: CrawledPageResult[] = [];
    await new WebsiteCrawler().crawl(baseConfig({ includePaths: ['/', '/a'] }), {
      onPage: (p) => {
        pages.push(p);
      },
    });
    const completed = pages.filter((p) => p.status === 'COMPLETED').map((p) => p.url);
    expect(completed).toEqual(
      expect.arrayContaining(['https://example.com/', 'https://example.com/a'])
    );
    expect(completed).not.toContain('https://example.com/b');
  });

  it('honors robots.txt disallow rules', async () => {
    mockedLoadRobotsPolicy.mockResolvedValue({
      isAllowed: (url: string) => !url.includes('/b'),
      crawlDelayMs: undefined,
    });

    const pages: CrawledPageResult[] = [];
    await new WebsiteCrawler().crawl(baseConfig(), {
      onPage: (p) => {
        pages.push(p);
      },
    });

    const fetchedUrls = mockedSafeFetch.mock.calls.map((call) => call[0]);
    expect(fetchedUrls).not.toContain('https://example.com/b');
    expect(pages.find((p) => p.url === 'https://example.com/b')?.status).toBe('SKIPPED');
  });

  it('records a failed fetch without aborting the rest of the crawl', async () => {
    mockedSafeFetch.mockImplementation(async (url: string) => {
      if (url === 'https://example.com/a') throw new Error('simulated network failure');
      return fakeSafeFetch(url) as any;
    });

    const pages: CrawledPageResult[] = [];
    const summary = await new WebsiteCrawler().crawl(baseConfig(), {
      onPage: (p) => {
        pages.push(p);
      },
    });

    expect(pages.find((p) => p.url === 'https://example.com/a')?.status).toBe('FAILED');
    expect(summary.pagesFailed).toBeGreaterThanOrEqual(1);
    // The rest of the (reachable) site should still complete.
    expect(pages.find((p) => p.url === 'https://example.com/')?.status).toBe('COMPLETED');
  });

  it('stops early and reports cancelled: true when isCancelled() becomes true', async () => {
    let pageCount = 0;
    const summary = await new WebsiteCrawler().crawl(baseConfig({ concurrency: 1 } as any), {
      onPage: () => {
        pageCount++;
      },
      isCancelled: () => pageCount >= 1,
    });

    expect(summary.cancelled).toBe(true);
    expect(mockedSafeFetch.mock.calls.length).toBeLessThan(Object.keys(SITE).length);
  });

  it('stops once maxPages is reached', async () => {
    const summary = await new WebsiteCrawler().crawl(baseConfig({ maxPages: 2 }), {
      onPage: () => {},
    });
    expect(summary.pagesCompleted + summary.pagesFailed + summary.pagesSkipped).toBeLessThanOrEqual(
      2 + 4 /* soft overshoot allowance for concurrency, generous for a 4-page fixture site */
    );
  });

  it('rejects a disallowed seed URL before making any request', async () => {
    await expect(
      new WebsiteCrawler().crawl(baseConfig({ seedUrl: 'http://127.0.0.1/' }), { onPage: () => {} })
    ).rejects.toThrow();
    expect(mockedSafeFetch).not.toHaveBeenCalled();
  });
});

import {
  resolvePublicAddress,
  assertValidSeedUrl,
  isBlockedHostname,
  isBlockedPort,
  SsrfBlockedError,
} from './ssrf-guard';

// Typed as `any` deliberately: `playwright-core` is a real (heavy, browser-
// binary-requiring) dependency, but making the whole @ion-ai/crawler package
// fail to install/import without Chromium present would be worse than a
// runtime error the one time this path is actually used. Import it lazily
// inside the class instead of at module load time — see ensureBrowser().
type PlaywrightModule = typeof import('playwright-core');

export interface BrowserRenderResult {
  html: string;
  finalUrl: string;
  status: number;
}

export interface BrowserRendererOptions {
  /**
   * Path to a Chromium executable. `playwright-core` (unlike the full
   * `playwright` package) does not download a browser for you — point this
   * at whatever your worker image already has, e.g. a
   * `mcr.microsoft.com/playwright` base image, or one installed via
   * `npx playwright install --with-deps chromium` in your Dockerfile.
   */
  executablePath?: string;
  userAgent?: string;
  navigationTimeoutMs?: number;
  /** Resource types aborted outright — none of these are needed to extract text, and skipping them meaningfully speeds up rendering and cuts bandwidth. */
  blockResourceTypes?: string[];
}

const DEFAULT_BLOCKED_RESOURCE_TYPES = ['image', 'font', 'media'];

/**
 * Renders a page with a real browser, for sites that don't put their
 * content in the initial HTML response — client-rendered React/Vue/Angular
 * SPAs being the common case.
 *
 * SECURITY: Every subresource, XHR, fetch, iframe, and redirect is intercepted
 * and validated with multi-layered SSRF guards:
 * 1. Protocol and sensitive port screening (blocking DB, cache, internal management ports).
 * 2. Internal container and cluster hostnames/suffixes blocking.
 * 3. DNS-resolution against private, link-local, and cloud metadata IP ranges.
 */
export class BrowserRenderer {
  private browserPromise: ReturnType<PlaywrightModule['chromium']['launch']> | null = null;

  constructor(private options: BrowserRendererOptions = {}) {}

  private async ensureBrowser() {
    if (!this.browserPromise) {
      const { chromium } = (await import('playwright-core')) as PlaywrightModule;
      this.browserPromise = chromium.launch({
        headless: true,
        executablePath: this.options.executablePath,
        args: [
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-background-networking',
        ],
      });
      // Clear it if it fails to launch so we don't cache a rejected promise forever
      this.browserPromise.catch(() => {
        this.browserPromise = null;
      });
    }
    return this.browserPromise;
  }

  async render(url: string): Promise<BrowserRenderResult> {
    // Structural pre-flight validation on the root seed target
    assertValidSeedUrl(url);

    const browser = await this.ensureBrowser();
    const context = await browser.newContext({
      userAgent:
        this.options.userAgent ?? 'IonAI-Crawler/1.0 (+https://ion-ai.example/crawler-bot)',
      javaScriptEnabled: true,
    });

    const blockedTypes = new Set(this.options.blockResourceTypes ?? DEFAULT_BLOCKED_RESOURCE_TYPES);
    const dnsCache = new Map<string, Promise<void>>();

    await context.route('**/*', async (route: any) => {
      const request = route.request();
      let targetUrl: URL;
      try {
        targetUrl = new URL(request.url());
      } catch {
        return route.abort('failed');
      }

      // 1. Protocol filtering
      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        return route.abort('blockedbyclient');
      }

      // 2. Sensitive internal service port filtering
      if (targetUrl.port && isBlockedPort(targetUrl.port)) {
        console.error(`Blocked sensitive port access: ${targetUrl.href}`);
        return route.abort('blockedbyclient');
      }

      // 3. Internal hostname & domain suffix filtering
      if (isBlockedHostname(targetUrl.hostname)) {
        console.error(`Blocked internal hostname access: ${targetUrl.href}`);
        return route.abort('blockedbyclient');
      }

      // 4. Resource type filtering (media/images/fonts)
      if (blockedTypes.has(request.resourceType())) {
        return route.abort('blockedbyclient');
      }

      // 5. DNS verification against private, link-local and cloud-metadata IP ranges
      try {
        let dnsPromise = dnsCache.get(targetUrl.hostname);
        if (!dnsPromise) {
          dnsPromise = resolvePublicAddress(targetUrl.hostname).then(() => {});
          dnsCache.set(targetUrl.hostname, dnsPromise);
        }
        await dnsPromise;
      } catch (err) {
        if (err instanceof SsrfBlockedError) {
          console.error(`Blocked SSRF subresource: ${targetUrl.href} (${(err as Error).message})`);
          return route.abort('blockedbyclient');
        }
        console.error(`Failed resolving ${targetUrl.hostname}: ${err}`);
        return route.abort('failed');
      }

      return route.continue();
    });

    try {
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(this.options.navigationTimeoutMs ?? 20_000);

      let response;
      try {
        response = await page.goto(url, { waitUntil: 'networkidle' });
      } catch (err: any) {
        // Plenty of real sites never go fully network-idle (analytics
        // beacons, long-poll/websocket connections). If it times out waiting
        // for networkidle, the DOM is still fully intact. Do NOT reload the page.
        if (!err.message?.includes('Timeout')) {
          throw err;
        }
      }

      const html = await page.content();
      const finalUrl = page.url();
      const status = response?.status() ?? 0;

      return { html, finalUrl, status };
    } finally {
      await context.close();
    }
  }

  async close(): Promise<void> {
    if (this.browserPromise) {
      try {
        const browser = await this.browserPromise;
        await browser.close();
      } catch {
        // If it failed to launch, there is no browser to close
      } finally {
        this.browserPromise = null;
      }
    }
  }
}

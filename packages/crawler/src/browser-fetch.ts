import { resolvePublicAddress, SsrfBlockedError } from './ssrf-guard';

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
 * SPAs being the common case (see content/spa-detection.ts for how the
 * static path decides it needs this).
 *
 * One Chromium process is reused across every page in a crawl (launching a
 * browser per page is far too slow/expensive); each page gets its own
 * throwaway BrowserContext so cookies/storage never leak between pages.
 *
 * SECURITY — this closes a *different* SSRF gap than safe-fetch.ts, and
 * closes it less tightly. Once a page's JavaScript is allowed to run, that
 * JS can issue its own requests (fetch/XHR/iframes/WebSocket) — every one
 * of those is intercepted and validated here via `context.route()`, the
 * same as the top-level navigation. What this can't do, unlike
 * safe-fetch.ts's custom DNS `lookup`, is pin the browser's socket to the
 * exact IP that was validated: Playwright doesn't expose that level of
 * control, so there's a narrow DNS-rebinding TOCTOU window between "we
 * resolved and allowed this hostname" and "Chromium's own resolver connects
 * to it". Treat this as the application-layer check it is — real network
 * egress policy (block RFC1918/link-local/cloud-metadata ranges at the
 * container/VPC level for whatever host runs this) is the actual boundary
 * for browser-based fetching of untrusted URLs, the same as it would be for
 * any headless-browser crawler regardless of implementation.
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
        args: ['--disable-dev-shm-usage', '--no-sandbox'],
      });
      // Clear it if it fails to launch so we don't cache a rejected promise forever
      this.browserPromise.catch(() => {
        this.browserPromise = null;
      });
    }
    return this.browserPromise;
  }

  async render(url: string): Promise<BrowserRenderResult> {
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

      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        return route.abort('blockedbyclient');
      }

      try {
        let dnsPromise = dnsCache.get(targetUrl.hostname);
        if (!dnsPromise) {
          dnsPromise = resolvePublicAddress(targetUrl.hostname).then(() => {});
          dnsCache.set(targetUrl.hostname, dnsPromise);
        }
        await dnsPromise;
      } catch (err) {
        if (err instanceof SsrfBlockedError) {
          console.error(`Blocked SSRF: ${targetUrl.href}`);
          return route.abort('blockedbyclient');
        }
        console.error(`Failed resolving ${targetUrl.hostname}: ${err}`);
        return route.abort('failed');
      }

      if (blockedTypes.has(request.resourceType())) {
        console.error(`Blocked by resource type (${request.resourceType()}): ${targetUrl.href}`);
        return route.abort('blockedbyclient');
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
        // for networkidle, the DOM is still fully intact and whatever JS
        // managed to run has already run. Do NOT reload the page.
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

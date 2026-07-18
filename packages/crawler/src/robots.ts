import robotsParser from 'robots-parser';
import { safeFetch } from './safe-fetch';
import { CRAWLER_DEFAULTS } from './types';

export interface RobotsPolicy {
  isAllowed(url: string): boolean;
  crawlDelayMs: number | undefined;
}

/** A policy that allows everything — used when robots.txt fetching is disabled or the fetch fails. */
const ALLOW_ALL: RobotsPolicy = {
  isAllowed: () => true,
  crawlDelayMs: undefined,
};

/**
 * Fetches and parses `{origin}/robots.txt` for the given seed URL's origin.
 * A missing or unreachable robots.txt is treated as "allow everything" —
 * that's the standard convention (RFC 9309 §2.3: unreachable → no rules to
 * apply), not a reason to fail the whole crawl. A robots.txt that
 * successfully loads and returns a 200 with actual Disallow rules IS
 * enforced, though.
 */
export async function loadRobotsPolicy(
  seedUrl: string,
  userAgent: string,
  onLog?: (level: 'info' | 'warn', message: string) => void
): Promise<RobotsPolicy> {
  const robotsUrl = new URL('/robots.txt', seedUrl).toString();

  try {
    const res = await safeFetch(robotsUrl, {
      userAgent,
      timeoutMs: CRAWLER_DEFAULTS.requestTimeoutMs,
      maxResponseBytes: 512 * 1024, // robots.txt files are small; 512KB is generous
      maxRedirects: CRAWLER_DEFAULTS.maxRedirects,
    });

    if (res.statusCode >= 400) {
      onLog?.('info', `robots.txt returned ${res.statusCode}; treating as allow-all.`);
      return ALLOW_ALL;
    }

    const parsed = robotsParser(robotsUrl, res.body.toString('utf-8'));
    return {
      isAllowed: (url: string) => parsed.isAllowed(url, userAgent) !== false,
      crawlDelayMs: (() => {
        const seconds = parsed.getCrawlDelay(userAgent);
        return typeof seconds === 'number' ? seconds * 1000 : undefined;
      })(),
    };
  } catch (err: any) {
    onLog?.('warn', `Could not fetch robots.txt (${err.message}); treating as allow-all.`);
    return ALLOW_ALL;
  }
}

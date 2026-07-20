import dns from 'node:dns';
import net from 'node:net';

/**
 * Blocks the crawler from being used as an SSRF vector against your own
 * infrastructure (internal services, cloud metadata endpoints, etc.).
 *
 * This is a real risk for this feature specifically: the seed URL is
 * supplied by an org admin, and this code runs server-side in your worker,
 * inside your VPC/cloud account. A malicious or merely careless admin could
 * enter `http://169.254.169.254/latest/meta-data/` or `http://localhost:6379`
 * and, without this guard, your crawler would happily fetch it on their
 * behalf and hand the response back to them via the ingested "knowledge".
 *
 * Two checks are required, not one:
 *  1. `assertPublicHostname` — a cheap pre-flight check when a CrawlJob is
 *     created, so obviously-bad input is rejected immediately with a clear
 *     error instead of silently queued.
 *  2. `resolvePublicAddress` — called by `safe-fetch.ts` immediately before
 *     every single TCP connection (initial request AND every redirect hop).
 *     This is the one that actually matters: DNS can resolve differently
 *     between the time you check and the time you connect ("DNS rebinding"),
 *     so the address that gets validated must be the *exact* address that
 *     gets connected to — never re-resolved in between. See safe-fetch.ts
 *     for how the two are kept atomic via a custom `lookup` function.
 */

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

const BLOCKED_IPV4_RANGES: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // RFC1918
  ['100.64.0.0', 10], // CGNAT (RFC6598) — also used by some cloud metadata proxies
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local — includes 169.254.169.254 cloud metadata
  ['172.16.0.0', 12], // RFC1918
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // RFC1918
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved
];

function ipv4ToLong(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isBlockedIPv4(ip: string): boolean {
  const target = ipv4ToLong(ip);
  return BLOCKED_IPV4_RANGES.some(([base, prefix]) => {
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    return (target & mask) === (ipv4ToLong(base) & mask);
  });
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true; // loopback
  if (normalized === '::') return true; // unspecified
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // unique local (fc00::/7)
  if (normalized.startsWith('::ffff:')) {
    // IPv4-mapped IPv6 — unwrap and re-check as IPv4
    const mapped = normalized.split(':').pop()!;
    if (net.isIPv4(mapped)) return isBlockedIPv4(mapped);
  }
  return false;
}

/** True if the given literal IP address (v4 or v6) is disallowed as a crawl target. */
export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIPv4(ip);
  if (net.isIPv6(ip)) return isBlockedIPv6(ip);
  // Not a parseable IP literal at all — treat as blocked, the caller should
  // have resolved a hostname to an IP before calling this.
  return true;
}

/**
 * Cheap, DNS-free structural validation done at CrawlJob-creation time:
 * rejects bad protocols, credentials-in-URL, and IP literals that are
 * obviously private. Does NOT resolve hostnames — that happens per-request
 * in safe-fetch.ts, right before connecting, which is the check that
 * actually has to hold.
 */
export function assertValidSeedUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new SsrfBlockedError('Not a valid absolute URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SsrfBlockedError(`Protocol "${parsed.protocol}" is not allowed; use http or https.`);
  }

  if (parsed.username || parsed.password) {
    throw new SsrfBlockedError('URLs with embedded credentials are not allowed.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new SsrfBlockedError('Crawling localhost is not allowed.');
  }

  if (net.isIP(hostname) && isBlockedIp(hostname)) {
    throw new SsrfBlockedError('Crawling private/reserved IP addresses is not allowed.');
  }

  return parsed;
}

const globalDnsCache = new Map<string, Promise<{ address: string; family: 4 | 6 }>>();

/**
 * Resolves `hostname` and returns ONE validated public IP address + family,
 * throwing if the hostname is an IP literal in a blocked range, or if every
 * resolved address is blocked (a hostname can resolve to multiple; a site
 * that mixes public and internal addresses is treated as unsafe entirely —
 * we never "pick the safe one and hope").
 */
export async function resolvePublicAddress(
  hostname: string
): Promise<{ address: string; family: 4 | 6 }> {
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new SsrfBlockedError(`IP address ${hostname} is not allowed.`);
    }
    return { address: hostname, family: net.isIPv6(hostname) ? 6 : 4 };
  }

  let promise = globalDnsCache.get(hostname);
  if (!promise) {
    promise = (async () => {
      const results = await dns.promises.lookup(hostname, { all: true, verbatim: true });
      if (results.length === 0) {
        throw new SsrfBlockedError(`Could not resolve hostname: ${hostname}`);
      }

      for (const { address } of results) {
        if (isBlockedIp(address)) {
          throw new SsrfBlockedError(
            `Hostname "${hostname}" resolves to a private/reserved address (${address}); refusing to crawl.`
          );
        }
      }

      const first = results[0];
      return { address: first.address, family: first.family as 4 | 6 };
    })();

    globalDnsCache.set(hostname, promise);

    // Evict after 5 minutes to respect DNS TTLs loosely
    promise
      .catch(() => {})
      .finally(() => {
        setTimeout(
          () => {
            if (globalDnsCache.get(hostname) === promise) {
              globalDnsCache.delete(hostname);
            }
          },
          5 * 60 * 1000
        ).unref();
      });
  }

  return promise;
}

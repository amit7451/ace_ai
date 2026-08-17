import dns from 'node:dns';
import net from 'node:net';

/**
 * Blocks the crawler from being used as an SSRF vector against internal
 * infrastructure (internal services, cloud metadata endpoints, etc.).
 */

export class SsrfBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsrfBlockedError';
  }
}

export const BLOCKED_IPV4_RANGES: Array<[string, number]> = [
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

export const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'postgres',
  'redis',
  'qdrant',
  'api',
  'worker',
  'dashboard',
  'nginx',
  'db',
  'cache',
  'host.docker.internal',
  'gateway.docker.internal',
  'kubernetes.default',
  'kubernetes.default.svc',
  'metadata.google.internal',
  'instance-data',
  'metadata',
]);

export const BLOCKED_DOMAIN_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home',
  '.corp',
  '.intra',
  '.invalid',
  '.test',
  '.cluster.local',
  '.svc',
];

export const BLOCKED_PORTS = new Set([
  21, // FTP
  22, // SSH
  23, // Telnet
  25, // SMTP
  53, // DNS
  110, // POP3
  143, // IMAP
  465, // SMTPS
  587, // Submission
  993, // IMAPS
  995, // POP3S
  2375, // Docker daemon (unencrypted)
  2376, // Docker daemon (TLS)
  2379, // etcd
  2380, // etcd
  3306, // MySQL
  5432, // PostgreSQL
  6379, // Redis
  6333, // Qdrant HTTP
  6334, // Qdrant gRPC
  9090, // Prometheus
  9100, // Node Exporter
  10250, // Kubelet
  10255, // Kubelet read-only
  11434, // Ollama
  27017, // MongoDB
]);

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
  return true;
}

/** True if the given hostname is an internal container, loopback, or private domain. */
export function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (BLOCKED_DOMAIN_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true;
  return false;
}

/** True if the given port is a known sensitive internal service port. */
export function isBlockedPort(port: string | number): boolean {
  if (!port) return false;
  const num = typeof port === 'number' ? port : parseInt(port, 10);
  if (isNaN(num)) return false;
  return BLOCKED_PORTS.has(num);
}

/**
 * Structural validation done at CrawlJob-creation time and before browser navigation:
 * rejects bad protocols, credentials-in-URL, private IP literals, and internal hostnames/ports.
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
  if (isBlockedHostname(hostname)) {
    throw new SsrfBlockedError(`Crawling internal/private host "${hostname}" is not allowed.`);
  }

  if (parsed.port && isBlockedPort(parsed.port)) {
    throw new SsrfBlockedError(`Crawling sensitive port ${parsed.port} is not allowed.`);
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
 * resolved address is blocked.
 */
export async function resolvePublicAddress(
  hostname: string
): Promise<{ address: string; family: 4 | 6 }> {
  if (isBlockedHostname(hostname)) {
    throw new SsrfBlockedError(`Access to internal hostname "${hostname}" is blocked.`);
  }

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

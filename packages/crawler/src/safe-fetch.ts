import http, { IncomingMessage } from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import { resolvePublicAddress, SsrfBlockedError } from './ssrf-guard';

export class SafeFetchError extends Error {
  constructor(
    message: string,
    public readonly code:
      'SSRF_BLOCKED' | 'TIMEOUT' | 'TOO_LARGE' | 'TOO_MANY_REDIRECTS' | 'NETWORK_ERROR' | 'NON_HTML'
  ) {
    super(message);
    this.name = 'SafeFetchError';
  }
}

export interface SafeFetchOptions {
  userAgent: string;
  timeoutMs: number;
  maxResponseBytes: number;
  maxRedirects: number;
  /**
   * If provided, the response's Content-Type header is checked as soon as
   * headers arrive; if it doesn't match, the connection is destroyed
   * immediately without reading the body (saves bandwidth on the vast
   * majority of "not actually a page" responses: images, PDFs, etc. linked
   * from a page we're crawling).
   */
  acceptContentType?: (contentType: string | undefined) => boolean;
  /** Called once per redirect hop with the URL about to be validated + fetched. */
  onRedirect?: (fromUrl: string, toUrl: string) => void;
}

export interface SafeFetchResult {
  finalUrl: string;
  statusCode: number;
  headers: IncomingMessage['headers'];
  body: Buffer;
}

/**
 * Fetches a single URL with full SSRF protection, a hard response-size cap,
 * a request timeout, and manually-validated redirect following.
 *
 * Why not the global `fetch`: undici's fetch has no supported way to pin the
 * exact IP address a request connects to while still validating it first,
 * which is what closes the DNS-rebinding gap (resolve now, connect to a
 * *different* address later because the attacker's DNS TTL is 0). Node's
 * `http.request`/`https.request` accept a custom `lookup` function that is
 * called internally at the moment of connecting — supplying our own lets us
 * validate and connect to the same address atomically, and disabling
 * automatic redirects lets us re-run that same validation on every hop
 * instead of only on the first request.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions
): Promise<SafeFetchResult> {
  let currentUrl = rawUrl;
  let redirectCount = 0;

  while (true) {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new SafeFetchError(`Protocol "${parsed.protocol}" is not allowed.`, 'SSRF_BLOCKED');
    }

    // Resolve + validate now; the `lookup` override below guarantees the
    // TCP connection uses this exact address, not a fresh (possibly
    // different) resolution.
    const validated = await resolvePublicAddress(parsed.hostname).catch((err) => {
      throw new SafeFetchError(err.message, 'SSRF_BLOCKED');
    });

    const result = await singleRequest(parsed, validated, options);

    if (result.type === 'redirect') {
      redirectCount += 1;
      if (redirectCount > options.maxRedirects) {
        throw new SafeFetchError(
          `Exceeded ${options.maxRedirects} redirects.`,
          'TOO_MANY_REDIRECTS'
        );
      }
      const nextUrl = new URL(result.location, parsed).toString();
      options.onRedirect?.(currentUrl, nextUrl);
      currentUrl = nextUrl;
      continue;
    }

    return result.value;
  }
}

type SingleRequestOutcome =
  { type: 'redirect'; location: string } | { type: 'final'; value: SafeFetchResult };

function singleRequest(
  parsed: URL,
  validated: { address: string; family: 4 | 6 },
  options: SafeFetchOptions
): Promise<SingleRequestOutcome> {
  return new Promise((resolve, reject) => {
    const transport = parsed.protocol === 'https:' ? https : http;

    const req = transport.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        // Pinning the DNS answer: Node calls this instead of its own
        // resolver, so the socket connects to exactly the address we
        // already validated — not a re-resolved one. Node's Happy-Eyeballs
        // connection path (default since Node 18) calls this with
        // `{ all: true }` and expects a single `(err, addresses[])` array
        // argument rather than the classic `(err, address, family)` triple —
        // both forms have to be handled, or the request throws
        // `ERR_INVALID_IP_ADDRESS` deep inside `net` with a confusing stack.
        lookup: (_hostname, opts, callback: any) => {
          if (typeof opts === 'function') {
            // Classic 2-arg dns.lookup form: (hostname, callback)
            (opts as any)(null, validated.address, validated.family);
            return;
          }
          if (opts && (opts as any).all) {
            callback(null, [{ address: validated.address, family: validated.family }]);
          } else {
            callback(null, validated.address, validated.family);
          }
        },
        servername: parsed.protocol === 'https:' ? parsed.hostname : undefined, // correct SNI/cert check even though we dialed an IP
        headers: {
          'User-Agent': options.userAgent,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Encoding': 'identity', // keep body-size accounting simple and exact
        },
        timeout: options.timeoutMs,
      },
      (res) => {
        const statusCode = res.statusCode ?? 0;

        if ([301, 302, 303, 307, 308].includes(statusCode)) {
          const location = res.headers.location;
          res.resume(); // discard body
          if (!location) {
            reject(
              new SafeFetchError(
                `Redirect (${statusCode}) with no Location header.`,
                'NETWORK_ERROR'
              )
            );
            return;
          }
          resolve({ type: 'redirect', location });
          return;
        }

        if (options.acceptContentType && !options.acceptContentType(res.headers['content-type'])) {
          res.destroy();
          reject(
            new SafeFetchError(
              `Rejected content-type "${res.headers['content-type'] ?? 'unknown'}".`,
              'NON_HTML'
            )
          );
          return;
        }

        const chunks: Buffer[] = [];
        let received = 0;

        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (received > options.maxResponseBytes) {
            res.destroy();
            reject(
              new SafeFetchError(
                `Response exceeded ${options.maxResponseBytes} bytes.`,
                'TOO_LARGE'
              )
            );
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          resolve({
            type: 'final',
            value: {
              finalUrl: parsed.toString(),
              statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks),
            },
          });
        });

        res.on('error', (err) => reject(new SafeFetchError(err.message, 'NETWORK_ERROR')));
      }
    );

    req.on('timeout', () => {
      req.destroy(new SafeFetchError(`Request timed out after ${options.timeoutMs}ms.`, 'TIMEOUT'));
    });

    req.on('error', (err) => {
      if (err instanceof SafeFetchError) reject(err);
      else if (
        (err as any)?.message?.includes('SsrfBlockedError') ||
        err instanceof SsrfBlockedError
      ) {
        reject(new SafeFetchError(err.message, 'SSRF_BLOCKED'));
      } else reject(new SafeFetchError(err.message, 'NETWORK_ERROR'));
    });

    req.end();
  });
}

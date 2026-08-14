/**
 * Extracts retry-after duration in milliseconds from HTTP response headers
 * and structured vendor error payloads (Google RPC RetryInfo, message strings, OpenAI headers).
 */
export function extractRetryAfter(
  headers?: { get(name: string): string | null } | Record<string, any>,
  bodyText?: string
): number | undefined {
  // 1. Standard HTTP header "retry-after" (in seconds or timestamp)
  const headerVal =
    typeof headers?.get === 'function'
      ? headers.get('retry-after')
      : (headers as any)?.['retry-after'];
  if (headerVal) {
    const parsed = parseFloat(headerVal);
    if (!isNaN(parsed) && parsed > 0) {
      return Math.ceil(parsed * 1000);
    }
  }

  // 2. Parse structured vendor error response (e.g. Google Gemini RPC details / text messages)
  if (bodyText) {
    try {
      const parsedJson = JSON.parse(bodyText);

      // Check Google RPC RetryInfo in error.details
      const details = parsedJson?.error?.details;
      if (Array.isArray(details)) {
        for (const detail of details) {
          if (detail?.retryDelay && typeof detail.retryDelay === 'string') {
            const delayStr = detail.retryDelay.replace(/s$/i, '').trim();
            const sec = parseFloat(delayStr);
            if (!isNaN(sec) && sec > 0) {
              return Math.ceil(sec * 1000);
            }
          }
        }
      }

      // Check pattern in error.message (e.g. "Please retry in 46.252741297s.")
      if (typeof parsedJson?.error?.message === 'string') {
        const match = /retry in\s+([0-9.]+)\s*s/i.exec(parsedJson.error.message);
        if (match) {
          const sec = parseFloat(match[1]);
          if (!isNaN(sec) && sec > 0) {
            return Math.ceil(sec * 1000);
          }
        }
      }
    } catch {}
  }

  return undefined;
}

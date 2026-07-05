/**
 * Lightweight fetch-response fakes for provider tests. Not a spec file
 * itself (no .spec.ts suffix), just shared helpers.
 */

export function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    body: null,
  };
}

export function errorResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    json: async () => ({ error: message }),
    text: async () => message,
    body: null,
  };
}

/** Simulates a fetch Response whose body is a stream of raw text chunks. */
export function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  let index = 0;

  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    text: async () => '',
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) {
              return { done: true, value: undefined };
            }
            const value = encoder.encode(chunks[index]);
            index += 1;
            return { done: false, value };
          },
          releaseLock() {
            /* no-op for the fake */
          },
        };
      },
    },
  };
}

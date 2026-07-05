/**
 * Minimal structural shape we need from a fetch Response body. Deliberately
 * NOT the global DOM/Node ReadableStream type — depending only on this
 * narrow shape avoids coupling to whichever lib happens to provide fetch
 * typings, while still accepting the real object at runtime.
 */
export interface ReadableStreamLike {
  getReader(): {
    read(): Promise<{ done: boolean; value?: Uint8Array }>;
    releaseLock(): void;
  };
}

/**
 * Parses a Server-Sent-Events body (`data: {...}\n\n`, terminated by
 * `data: [DONE]`) into raw JSON string payloads. Used by OpenAI-compatible
 * providers, Anthropic, and Gemini's SSE streaming mode.
 */
export async function* parseSSEStream(body: ReadableStreamLike): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const data = trimmed.slice('data:'.length).trim();
        if (data === '[DONE]') return;
        if (data.length > 0) yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parses a newline-delimited-JSON body (one JSON object per line, no
 * `data:` prefix). Used by Ollama's native streaming format.
 */
export async function* parseNDJSONStream(body: ReadableStreamLike): AsyncGenerator<string, void, unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) yield trimmed;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

import {
  parseSSEStream,
  parseNDJSONStream,
  type ReadableStreamLike,
} from '../../../src/llm/utils/stream-parser.util';

function createMockStream(chunks: string[]): ReadableStreamLike {
  const encoder = new TextEncoder();
  let index = 0;
  return {
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
          /* no-op */
        },
      };
    },
  };
}

describe('parseSSEStream', () => {
  it('yields data payloads from well-formed SSE lines', async () => {
    const stream = createMockStream(['data: {"a":1}\n\n', 'data: {"a":2}\n\n', 'data: [DONE]\n\n']);
    const results: string[] = [];
    for await (const chunk of parseSSEStream(stream)) {
      results.push(chunk);
    }
    expect(results).toEqual(['{"a":1}', '{"a":2}']);
  });

  it('handles a data line split across two network reads', async () => {
    const stream = createMockStream(['data: {"a":', '1}\n\ndata: [DONE]\n\n']);
    const results: string[] = [];
    for await (const chunk of parseSSEStream(stream)) {
      results.push(chunk);
    }
    expect(results).toEqual(['{"a":1}']);
  });

  it('ignores blank lines and non-data lines', async () => {
    const stream = createMockStream(['event: ping\n\ndata: {"a":1}\n\n', 'data: [DONE]\n\n']);
    const results: string[] = [];
    for await (const chunk of parseSSEStream(stream)) {
      results.push(chunk);
    }
    expect(results).toEqual(['{"a":1}']);
  });

  it('stops iterating as soon as [DONE] is seen', async () => {
    const stream = createMockStream([
      'data: {"a":1}\n\n',
      'data: [DONE]\n\n',
      'data: {"a":999}\n\n',
    ]);
    const results: string[] = [];
    for await (const chunk of parseSSEStream(stream)) {
      results.push(chunk);
    }
    expect(results).toEqual(['{"a":1}']);
  });
});

describe('parseNDJSONStream', () => {
  it('yields one JSON string per line', async () => {
    const stream = createMockStream(['{"done":false}\n{"done":', 'false}\n{"done":true}\n']);
    const results: string[] = [];
    for await (const chunk of parseNDJSONStream(stream)) {
      results.push(chunk);
    }
    expect(results).toEqual(['{"done":false}', '{"done":false}', '{"done":true}']);
  });

  it('ignores blank lines', async () => {
    const stream = createMockStream(['{"a":1}\n\n{"a":2}\n']);
    const results: string[] = [];
    for await (const chunk of parseNDJSONStream(stream)) {
      results.push(chunk);
    }
    expect(results).toEqual(['{"a":1}', '{"a":2}']);
  });
});

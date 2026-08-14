import { extractRetryAfter } from '../../../src/embedding/utils/retry-after';

describe('extractRetryAfter', () => {
  it('extracts duration in ms from standard retry-after header', () => {
    const headers = { get: (k: string) => (k === 'retry-after' ? '30' : null) };
    expect(extractRetryAfter(headers)).toBe(30000);
  });

  it('extracts duration in ms from Google RPC RetryInfo detail in json body', () => {
    const body = JSON.stringify({
      error: {
        code: 429,
        message: 'Quota exceeded',
        details: [
          {
            '@type': 'type.googleapis.com/google.rpc.RetryInfo',
            retryDelay: '46s',
          },
        ],
      },
    });
    expect(extractRetryAfter(undefined, body)).toBe(46000);
  });

  it('extracts duration in ms from text message retry pattern', () => {
    const body = JSON.stringify({
      error: {
        code: 429,
        message: 'Please retry in 12.5s.',
      },
    });
    expect(extractRetryAfter(undefined, body)).toBe(12500);
  });

  it('returns undefined when no retry info is present', () => {
    expect(
      extractRetryAfter(undefined, JSON.stringify({ error: { message: 'Bad request' } }))
    ).toBeUndefined();
  });
});

import { retryWithBackoff, withTimeout } from '../../../src/vector-store/utils/retry';
import {
  VectorStoreConnectionError,
  VectorStoreAuthenticationError,
} from '../../../src/vector-store/errors/vector-store.errors';

describe('retryWithBackoff', () => {
  it('returns the result on the first successful attempt without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a retryable error and eventually succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new VectorStoreConnectionError('boom', { provider: 'qdrant' }))
      .mockResolvedValueOnce('recovered');

    const result = await retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable error', async () => {
    const authError = new VectorStoreAuthenticationError('nope', { provider: 'qdrant' });
    const fn = jest.fn().mockRejectedValue(authError);

    await expect(retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 })).rejects.toBe(authError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws the last error once retries are exhausted', async () => {
    const error = new VectorStoreConnectionError('still down', { provider: 'qdrant' });
    const fn = jest.fn().mockRejectedValue(error);

    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
  });
});

describe('withTimeout', () => {
  it('resolves normally when the promise finishes before the timeout', async () => {
    const result = await withTimeout(
      Promise.resolve('fast'),
      1000,
      () => new Error('should not fire')
    );
    expect(result).toBe('fast');
  });

  it('rejects with the provided error when the timeout elapses first', async () => {
    const neverResolves = new Promise(() => undefined);
    await expect(withTimeout(neverResolves, 10, () => new Error('timed out'))).rejects.toThrow(
      'timed out'
    );
  });
});

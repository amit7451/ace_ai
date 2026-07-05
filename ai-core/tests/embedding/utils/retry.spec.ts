import { retryWithBackoff } from '../../../src/embedding/utils/retry';

describe('retryWithBackoff', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries retryable errors up to maxRetries then succeeds', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce('ok');
    const result = await retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately when isRetryable returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fatal'));
    await expect(
      retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1, isRetryable: () => false }),
    ).rejects.toThrow('fatal');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws the last error after exhausting all retries', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('still failing'));
    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow('still failing');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('calls onRetry with attempt number and delay', async () => {
    const onRetry = jest.fn();
    const fn = jest.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce('ok');
    await retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][1]).toBe(1);
  });
});

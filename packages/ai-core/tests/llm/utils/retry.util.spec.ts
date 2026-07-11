import { retryWithBackoff } from '../../../src/llm/utils/retry.util';
import { LLMRateLimitError, LLMAuthenticationError } from '../../../src/llm/errors/llm.errors';

describe('retryWithBackoff', () => {
  it('returns the result immediately when the function succeeds on the first try', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries a retryable error until it succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new LLMRateLimitError({ provider: 'test' }))
      .mockRejectedValueOnce(new LLMRateLimitError({ provider: 'test' }))
      .mockResolvedValueOnce('recovered');

    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws immediately for a non-retryable error', async () => {
    const fn = jest.fn().mockRejectedValue(new LLMAuthenticationError({ provider: 'test' }));

    await expect(retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1 })).rejects.toBeInstanceOf(
      LLMAuthenticationError
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting all retries', async () => {
    const fn = jest.fn().mockRejectedValue(new LLMRateLimitError({ provider: 'test' }));

    await expect(retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toBeInstanceOf(
      LLMRateLimitError
    );
    expect(fn).toHaveBeenCalledTimes(3); // initial attempt + 2 retries
  });

  it('respects a custom isRetryable predicate', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('custom error'));
    const isRetryable = jest.fn().mockReturnValue(false);

    await expect(
      retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 1, isRetryable })
    ).rejects.toThrow('custom error');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(isRetryable).toHaveBeenCalledTimes(1);
  });

  it('calls onRetry with the attempt number and computed delay', async () => {
    const onRetry = jest.fn();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new LLMRateLimitError({ provider: 'test' }))
      .mockResolvedValueOnce('ok');

    await retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 1, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0][0]).toBe(1);
  });
});

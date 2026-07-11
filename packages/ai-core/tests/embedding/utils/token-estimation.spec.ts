import {
  estimateTokens,
  truncateToApproxTokenLimit,
} from '../../../src/embedding/utils/token-estimation';

describe('token estimation', () => {
  it('estimates roughly chars / 4', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });

  it('rounds up for partial tokens', () => {
    expect(estimateTokens('abc')).toBe(1);
  });

  it('leaves text under the limit unchanged', () => {
    const text = 'short text';
    expect(truncateToApproxTokenLimit(text, 100)).toBe(text);
  });

  it('truncates text over the approximate limit', () => {
    const text = 'a'.repeat(1000);
    const truncated = truncateToApproxTokenLimit(text, 10);
    expect(truncated.length).toBe(40);
  });
});

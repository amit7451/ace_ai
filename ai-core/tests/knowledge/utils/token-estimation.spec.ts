import { estimateTokens } from '../../../src/knowledge/utils/token-estimation';

describe('estimateTokens', () => {
  it('estimates roughly chars / 4', () => {
    expect(estimateTokens('a'.repeat(400))).toBe(100);
  });

  it('rounds up for a partial token', () => {
    expect(estimateTokens('abc')).toBe(1);
  });

  it('returns 0 for empty text', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

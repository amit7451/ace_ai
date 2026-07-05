import { estimateTokensFromText, estimateTokensFromMessages } from '../../../src/llm/utils/token-estimator.util';

describe('estimateTokensFromText', () => {
  it('returns 0 for empty text', () => {
    expect(estimateTokensFromText('')).toBe(0);
  });

  it('estimates roughly 1 token per 4 characters', () => {
    expect(estimateTokensFromText('a'.repeat(40))).toBe(10);
  });
});

describe('estimateTokensFromMessages', () => {
  it('sums per-message estimates plus a fixed overhead per message', () => {
    const messages = [
      { role: 'user' as const, content: 'a'.repeat(8) },
      { role: 'assistant' as const, content: 'a'.repeat(8) },
    ];
    // 8 chars -> 2 tokens, + 4 overhead, per message, times 2 messages
    expect(estimateTokensFromMessages(messages)).toBe(2 * (2 + 4));
  });

  it('returns 0 for an empty message list', () => {
    expect(estimateTokensFromMessages([])).toBe(0);
  });
});

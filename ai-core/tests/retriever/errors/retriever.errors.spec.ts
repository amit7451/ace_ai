import {
  RetrieverError,
  RetrieverDimensionMismatchError,
  RetrieverUnsupportedStrategyError,
} from '../../../src/retriever/errors/retriever.errors';

describe('RetrieverError hierarchy', () => {
  it('RetrieverError carries an optional cause and is a real Error', () => {
    const cause = new Error('inner');
    const error = new RetrieverError('something went wrong', cause);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('RetrieverError');
    expect(error.cause).toBe(cause);
  });

  it('RetrieverDimensionMismatchError reports collection/expected/received/model in its message', () => {
    const error = new RetrieverDimensionMismatchError('assistant_abc', 1536, 768, 'text-embedding-3-small');
    expect(error).toBeInstanceOf(RetrieverError);
    expect(error.collection).toBe('assistant_abc');
    expect(error.expected).toBe(1536);
    expect(error.received).toBe(768);
    expect(error.message).toContain('assistant_abc');
    expect(error.message).toContain('1536');
    expect(error.message).toContain('768');
    expect(error.message).toContain('text-embedding-3-small');
  });

  it('RetrieverUnsupportedStrategyError names the offending strategy', () => {
    const error = new RetrieverUnsupportedStrategyError('made-up-strategy');
    expect(error.strategy).toBe('made-up-strategy');
    expect(error.message).toContain('made-up-strategy');
  });
});

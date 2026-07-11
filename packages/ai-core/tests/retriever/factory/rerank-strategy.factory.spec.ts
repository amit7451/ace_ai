import { RerankStrategyFactory } from '../../../src/retriever/factory/rerank-strategy.factory';
import { SimilarityThresholdRerankStrategy } from '../../../src/retriever/strategies/similarity-threshold/similarity-threshold-rerank.strategy';
import { MmrRerankStrategy } from '../../../src/retriever/strategies/mmr/mmr-rerank.strategy';
import { RetrieverUnsupportedStrategyError } from '../../../src/retriever/errors/retriever.errors';

describe('RerankStrategyFactory', () => {
  it('creates a SimilarityThresholdRerankStrategy for "similarity-threshold"', () => {
    const strategy = RerankStrategyFactory.create('similarity-threshold');
    expect(strategy).toBeInstanceOf(SimilarityThresholdRerankStrategy);
  });

  it('creates an MmrRerankStrategy for "mmr"', () => {
    const strategy = RerankStrategyFactory.create('mmr');
    expect(strategy).toBeInstanceOf(MmrRerankStrategy);
  });

  it('throws RetrieverUnsupportedStrategyError for an unknown strategy name', () => {
    // @ts-expect-error deliberately invalid input to exercise the guard
    expect(() => RerankStrategyFactory.create('not-a-real-strategy')).toThrow(
      RetrieverUnsupportedStrategyError
    );
  });

  it('lists all supported strategies', () => {
    expect(RerankStrategyFactory.getSupportedStrategies()).toEqual(
      expect.arrayContaining(['similarity-threshold', 'mmr'])
    );
  });

  it('allows registering a custom strategy implementation and restores the original after', () => {
    class CustomStrategy extends SimilarityThresholdRerankStrategy {}

    RerankStrategyFactory.register('similarity-threshold', CustomStrategy);
    expect(RerankStrategyFactory.create('similarity-threshold')).toBeInstanceOf(CustomStrategy);

    RerankStrategyFactory.register('similarity-threshold', SimilarityThresholdRerankStrategy);
    expect(RerankStrategyFactory.create('similarity-threshold')).toBeInstanceOf(
      SimilarityThresholdRerankStrategy
    );
  });
});

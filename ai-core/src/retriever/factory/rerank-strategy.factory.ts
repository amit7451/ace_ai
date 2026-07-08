import type { IRerankStrategy } from '../interfaces/rerank-strategy.interface';
import type { RerankStrategyName } from '../types/retriever-config.types';
import { SimilarityThresholdRerankStrategy } from '../strategies/similarity-threshold/similarity-threshold-rerank.strategy';
import { MmrRerankStrategy } from '../strategies/mmr/mmr-rerank.strategy';
import { RetrieverUnsupportedStrategyError } from '../errors/retriever.errors';

type StrategyConstructor = new () => IRerankStrategy;

/**
 * Name in, `IRerankStrategy` out. The only place that knows about concrete
 * strategy classes — mirrors `ChunkingStrategyFactory` from Component 4
 * (strategy-pattern factory) rather than Components 1-3's vendor-provider
 * factories, since there's no third-party vendor on this axis.
 */
export class RerankStrategyFactory {
  private static readonly registry = new Map<RerankStrategyName, StrategyConstructor>([
    ['similarity-threshold', SimilarityThresholdRerankStrategy],
    ['mmr', MmrRerankStrategy],
  ]);

  static create(name: RerankStrategyName): IRerankStrategy {
    const StrategyClass = this.registry.get(name);
    if (!StrategyClass) {
      throw new RetrieverUnsupportedStrategyError(name);
    }
    return new StrategyClass();
  }

  /** Registers a custom or override strategy implementation. */
  static register(name: RerankStrategyName, strategyClass: StrategyConstructor): void {
    this.registry.set(name, strategyClass);
  }

  static getSupportedStrategies(): RerankStrategyName[] {
    return Array.from(this.registry.keys());
  }
}

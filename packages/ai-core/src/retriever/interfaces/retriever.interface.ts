import type { RetrievalQuery } from '../types/retrieval-query.types';
import type { RetrievalResult } from '../types/retrieval-result.types';

/**
 * The contract `RagRetriever` implements. Application code (the future AI
 * Orchestrator, Component 8) should depend on this interface rather than
 * `RagRetriever` directly — same "depend on the interface" discipline
 * Components 1-3 apply to their vendor providers.
 */
export interface IRetriever {
  retrieve(query: RetrievalQuery): Promise<RetrievalResult>;
  healthCheck(): Promise<boolean>;
}

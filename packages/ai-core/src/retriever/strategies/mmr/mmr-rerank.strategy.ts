import type { IRerankStrategy, RerankContext } from '../../interfaces/rerank-strategy.interface';
import type { VectorSearchResult } from '../../../vector-store/types/search.types';
import type { KnowledgeVectorPayload } from '../../../vector-store/types/vector-record.types';
import { cosineSimilarity } from '../../../embedding/utils/similarity';
import { filterByThreshold } from '../../utils/threshold-filter';

type CandidateWithVector<TPayload> = VectorSearchResult<TPayload> & { vector: number[] };

function hasVector<TPayload>(
  candidate: VectorSearchResult<TPayload>
): candidate is CandidateWithVector<TPayload> {
  return Array.isArray(candidate.vector);
}

/**
 * Maximal Marginal Relevance (Carbonell & Goldberg, 1998): iteratively
 * picks the candidate that maximizes
 * `lambda * relevance - (1 - lambda) * max_similarity_to_already_selected`,
 * trading off pure relevance against diversity. Reduces the "top 5 results
 * are 5 near-identical chunks of the same paragraph" failure mode that
 * plain score-sorting is prone to when a source document has repetitive
 * or heavily overlapping content.
 *
 * Requires candidate vectors (`requiresVectors = true`, which
 * `RagRetriever` wires into `withVector: true` on the search request),
 * and — like the classic MMR formulation — assumes similarity semantics
 * (cosine or dot product; higher = more relevant). Candidates without a
 * vector (shouldn't happen when `requiresVectors` is honored, but handled
 * defensively) are dropped rather than crashing the request.
 */
export class MmrRerankStrategy implements IRerankStrategy {
  readonly name = 'mmr' as const;
  readonly requiresVectors = true;

  rerank<TPayload = KnowledgeVectorPayload>(
    candidates: VectorSearchResult<TPayload>[],
    context: RerankContext
  ): VectorSearchResult<TPayload>[] {
    const eligible = filterByThreshold(
      candidates,
      context.scoreThreshold,
      context.distanceMetric
    ).filter(hasVector);

    const selected: CandidateWithVector<TPayload>[] = [];
    const remaining = [...eligible];

    while (selected.length < context.topK && remaining.length > 0) {
      let bestIndex = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const maxSimToSelected =
          selected.length === 0
            ? 0
            : Math.max(...selected.map((s) => cosineSimilarity(candidate.vector, s.vector)));
        const mmrScore =
          context.mmrLambda * candidate.score - (1 - context.mmrLambda) * maxSimToSelected;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      selected.push(remaining[bestIndex]);
      remaining.splice(bestIndex, 1);
    }

    return selected;
  }
}

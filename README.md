# AI Core — RAG Retriever Engine
### Core Engine Component 5 of 8 — AI Chatbot SaaS Platform

This package sits directly beside the LLM Provider Layer (Component 1),
Embedding Provider Layer (Component 2), Vector Store Layer (Component 3),
and Knowledge Chunking & Processing (Component 4) inside `packages/ai-core/`.
It turns a user's question into ranked, relevant `KnowledgeVectorPayload`
chunks — the "R" in RAG — implementing the architecture doc's Principle 1
(**Retrieval First**): `Knowledge → Retrieval → Prompt → LLM → Response`.
Component 6 (Prompt Builder) is the next consumer in that chain.

## What's inside

```
packages/ai-core/
├── src/
│   ├── llm/            (Component 1 — unchanged)
│   ├── embedding/       (Component 2 — unchanged)
│   ├── vector-store/    (Component 3 — unchanged)
│   ├── knowledge/       (Component 4 — unchanged)
│   └── retriever/
│       ├── types/        Query, result, and config type definitions
│       ├── interfaces/    IRetriever and IRerankStrategy contracts
│       ├── schemas/       Zod validation — including a real VectorFilter validator (see below)
│       ├── errors/        RetrieverError hierarchy (no HTTP mapping — see below)
│       ├── strategies/
│       │   ├── similarity-threshold/  The default: threshold + sort, no diversity awareness
│       │   └── mmr/                    Maximal Marginal Relevance — diversity-aware reranking
│       ├── utils/          Tenant-filter injection, threshold direction, dedup, token-budget trimming
│       ├── factory/        RerankStrategyFactory — name in, IRerankStrategy out
│       └── retriever/      RagRetriever — the façade most callers use
└── tests/
    └── retriever/          Mirrors src/retriever, one spec file per module
```

## Why this component looks different from Components 1-3 (but similar to Component 4)

Components 1-3 are "one interface, several *vendor* implementations behind
a factory." This component doesn't talk to any new third-party vendor —
it **composes** Component 2 (`IEmbeddingProvider`) and Component 3
(`IVectorStore`) into a single retrieval pipeline. The genuinely pluggable
axis here is *how results get reranked*, not *which company's API is being
called*, so this follows Component 4's shape instead: an interface
(`IRerankStrategy`) with a couple of real implementations behind a small
factory (`RerankStrategyFactory`), same as `IChunkingStrategy` /
`ChunkingStrategyFactory`. And like Component 4, there's no HTTP call
`RagRetriever` itself needs to retry or map status codes for — the two
network calls it makes (`embed`, `search`) already go through Components
2 and 3's own retry/error-normalization, so `RetrieverError` only covers
failure modes genuinely specific to retrieval itself.

## Integration fixes in this delivery

Components 1-4 were built and tested independently, each in its own
package sandbox — this is the first time all four (now five) have been
compiled and tested **together** as one `packages/ai-core`. Doing that
surfaced two real barrel-export collisions that only exist when the
modules are combined:

- `mapHttpStatusToError` was independently defined in both `llm/errors/`
  and `vector-store/errors/` (each mapping to a different domain's error
  type). Fixed by aliasing at each module's own barrel:
  `mapLLMHttpStatusToError` / `mapVectorStoreHttpStatusToError`.
- `estimateTokens` was independently defined in both `embedding/utils/`
  and `knowledge/utils/` (both the same `chars / 4` heuristic, by design —
  see each component's own "Known limitations"). Fixed the same way:
  `estimateEmbeddingTokens` / `estimateKnowledgeTokens`. This component
  adds a third independent copy for the same reason (see
  `utils/token-estimation.ts`) and is aliased to `estimateRetrieverTokens`
  at the root barrel for the same reason.

Neither fix changes any component's own internal behavior or its own
module-level exports (`from '.../llm'`, `from '.../embedding'`, etc. are
untouched) — only the **root** `src/index.ts` barrel needed the alias, and
only for these two names. Every internal cross-file import already used
the specific file path, not the barrel, so nothing else was affected. The
root `src/index.ts` itself had also never actually been updated past
Component 1 — `export * from './embedding'` etc. were never added — which
this delivery also fixes.

## Design principles applied

- **Provider Agnostic, transitively** — `RagRetriever` depends only on
  `IEmbeddingProvider` and `IVectorStore`, never on a concrete vendor from
  either layer. Swapping the embedding model or vector database
  underneath an app already using this retriever is a constructor-argument
  change, not a rewrite.
- **Tenant isolation is not optional** — `buildTenantFilter` unconditionally
  ANDs `tenantId`/`assistantId` match conditions into every search, whether
  or not the caller supplied a `filter`, and whether or not Component 3's
  collection topology (`one collection per assistant` vs. `one shared
  collection`) would already provide isolation on its own. This directly
  implements the architecture doc's Principle 2 ("No tenant can access
  another tenant's resources") as defense in depth, not redundant caution.
- **Distance-metric-aware thresholds** — `scoreThreshold` is interpreted
  correctly whether the collection uses cosine/dot (higher = better) or
  euclidean/manhattan (lower = better) distance, read once from
  `getCollectionInfo()` and cached — see `utils/threshold-filter.ts`.
- **Dimension-safety as a first-class concern, read-side** — Components
  2 and 3 already guard the *write* side
  (`EmbeddingDimensionMismatchError`, `VectorStoreDimensionMismatchError`).
  `RagRetriever` adds the *read*-side equivalent: the first `retrieve()`
  call verifies the embedding model's `dimensions` match the collection's
  `vectorSize`, so "the embedding model was swapped but the knowledge base
  wasn't re-indexed" fails immediately and clearly — see
  `RetrieverDimensionMismatchError` and its caching behavior, below.
- **Real `VectorFilter` validation** — Components 3 and 4 only ever pass a
  `VectorFilter` from trusted internal TypeScript code, so neither
  validates its shape at runtime. This is the first layer where a `filter`
  realistically arrives from outside the process (a chat API request's
  metadata filter), so `schemas/retriever-config.schema.ts` adds a real
  structural Zod validator (`vectorFilterSchema`) instead of a `z.any()`
  pass-through.
- **Relevance signal for domain-restriction** — `RetrievalResult.isRelevant`
  is `true` only when at least one chunk clears the score threshold. This
  is the concrete mechanism the architecture doc's Product Vision example
  depends on: a company chatbot asked "What is Quantum Physics?" should
  find nothing relevant and decline, not answer from the LLM's general
  knowledge. Component 6 (Prompt Builder) is expected to branch on this
  flag directly.

## Usage

```typescript
import { EmbeddingProviderFactory } from '@ai-chatbot-platform/ai-core'; // Component 2
import { VectorStoreProviderFactory } from '@ai-chatbot-platform/ai-core'; // Component 3
import { RagRetriever } from '@ai-chatbot-platform/ai-core'; // Component 5

const embedder = EmbeddingProviderFactory.create({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small',
});

const vectorStore = VectorStoreProviderFactory.create({
  provider: 'qdrant',
  url: process.env.QDRANT_URL ?? 'http://localhost:6333',
});

const retriever = new RagRetriever(embedder, vectorStore, {
  collection: 'assistant_abc123',
  topK: 5,
  scoreThreshold: 0.5,
});

const result = await retriever.retrieve({
  query: 'What is your refund policy?',
  tenantId: 'tenant_1',
  assistantId: 'assistant_abc123',
});

if (!result.isRelevant) {
  // Hand this off to Component 6 to build a "politely decline" response.
} else {
  console.log(result.chunks); // ranked, deduped, tenant-scoped chunks — feed straight into the prompt
}
```

Opting into diversity-aware reranking (fewer near-duplicate chunks from a
repetitive source document) is a config change:

```typescript
const retriever = new RagRetriever(embedder, vectorStore, {
  collection: 'assistant_abc123',
  strategy: 'mmr',
  mmrLambda: 0.5, // 0 = pure diversity, 1 = pure relevance (identical to similarity-threshold)
});
```

Capping how much context this retriever hands back (useful once Component
6 has a fixed prompt token budget to respect):

```typescript
const result = await retriever.retrieve({
  query: 'What is your refund policy?',
  tenantId: 'tenant_1',
  assistantId: 'assistant_abc123',
  maxContextTokens: 2000,
});
```

## Adding a new rerank strategy

1. Create `src/retriever/strategies/<name>/<name>-rerank.strategy.ts`
   implementing `IRerankStrategy`.
2. Add `'<name>'` to `RerankStrategyName` in
   `types/retriever-config.types.ts` and to `RERANK_STRATEGY_NAMES` in
   `schemas/retriever-config.schema.ts`.
3. Register it in `factory/rerank-strategy.factory.ts`.
4. Add a spec file under `tests/retriever/strategies/`.

No other module needs to change — `RagRetriever` only ever talks to
`IRerankStrategy`.

## Wiring into your existing project

`src/index.ts` now exports all five components (see "Integration fixes,"
above, for why this needed more than one added line):

```typescript
export * from './llm';          // Component 1
export * from './embedding';    // Component 2
export * from './vector-store'; // Component 3
export * from './knowledge';    // Component 4
export * from './retriever';    // Component 5 — add this line
```

No new dependencies — this layer reuses `zod` (already present since
Component 2) and Component 2's `cosineSimilarity` util (for MMR) — no new
package.json entries.

## Testing

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # jest
npm run test:coverage
```

Nothing in this component talks to the network directly — `RagRetriever`'s
tests construct fake `IEmbeddingProvider`/`IVectorStore` objects (plain
Jest mocks satisfying each interface) rather than mocking `fetch`, since
the whole point of depending on the interface is that a fake is trivial to
write. Verified in this delivery: a full strict `tsc --noEmit` pass across
all five components combined, a clean `tsc` build producing 122 total
declaration files, and **all 367 tests passing** (59 suites) across the
combined package — 60 of those tests are new in this delivery, including
an explicit MMR test that constructs two near-duplicate candidates plus
one diverse-but-lower-scoring one and asserts MMR picks the diverse
result over the redundant one, and the reverse assertion at `mmrLambda: 1`
(degenerates to plain top-K-by-score).

## Known limitations (by design, for this component)

- **Deduplication is exact-match-after-normalization, not fuzzy.** Two
  chunks with the same meaning but different wording are not caught — see
  `utils/deduplication.ts`. A fuzzy/embedding-similarity comparison across
  every candidate pair is real added cost (O(n²) cosine-similarity calls)
  for a benefit this platform doesn't need yet; MMR's diversity selection
  already substantially reduces near-duplicate results when enabled.
- **MMR assumes cosine/dot similarity semantics.** The classic MMR formula
  (`lambda * relevance - (1-lambda) * max_similarity`) reads naturally
  for "higher = more relevant." It is not adapted for
  euclidean/manhattan-distance collections the way
  `SimilarityThresholdRerankStrategy`'s threshold direction is — not
  recommended for such collections (see the strategy's own doc comment).
- **`maxContextTokens` trimming uses the same `chars / 4` heuristic as
  every other component**, not a real tokenizer — consistent with, and
  carrying the same known-limitation caveat as, Components 1, 2, and 4.
- **No query rewriting, expansion, or LLM-based reranking.** Retrieval
  here is embed-search-rerank only, matching the architecture doc's
  pipeline ordering (Retrieval happens *before* the LLM is ever called).
  Techniques like HyDE or an LLM-as-reranker pass belong in front of or
  behind this layer, not inside it — this keeps `RagRetriever` usable
  without an LLM provider configured at all, which matters for a
  retrieval-only evaluation harness or a dashboard "test this query"
  feature that shouldn't need a live LLM call.
- **Over-fetch multiplier (3x, minimum +10) is a fixed constant**, not
  configurable per instance yet. It exists so threshold filtering,
  reranking, and dedup have real candidates to work with beyond the final
  `topK` — raising it trades a marginally larger vector-store `search`
  request for better rerank/dedup quality. Exposing it as a config field is
  a natural, low-risk follow-up if a specific workload needs it.

## Core Engine roadmap

| # | Component | Status |
|---|-----------|--------|
| 1 | LLM Provider Layer | ✅ done |
| 2 | Embedding Provider Layer | ✅ done |
| 3 | Vector Store Layer (Qdrant) | ✅ done |
| 4 | Knowledge Chunking & Processing | ✅ done |
| 5 | **RAG Retriever Engine** | ✅ this delivery |
| 6 | Prompt Builder / Domain Guardrails | next |
| 7 | Conversation Memory | planned |
| 8 | AI Orchestrator (ties it all together) | planned |

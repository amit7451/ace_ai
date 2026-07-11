# AI Core — Vector Store Layer (Qdrant)

### Core Engine Component 3 of 8 — AI Chatbot SaaS Platform

This package sits directly beside the LLM Provider Layer (Component 1) and
Embedding Provider Layer (Component 2) inside `packages/ai-core/`. It
provides a single, provider-agnostic interface for storing and searching
embedding vectors. Knowledge Chunking, RAG Retriever (Components 4 and 5)
depend on `IVectorStore`, never on Qdrant's client directly, so swapping
vector databases later is a configuration change, not a code change
(Principle 3: **Provider Agnostic**).

## What's inside

```
packages/ai-core/
├── src/
│   ├── llm/                   (Component 1 — unchanged)
│   ├── embedding/              (Component 2 — unchanged)
│   └── vector-store/
│       ├── types/              Config, collection, record, search/filter types
│       ├── interfaces/         The IVectorStore contract
│       ├── schemas/            Zod validation for store + collection config
│       ├── errors/             Normalized error hierarchy + HTTP status mapping
│       ├── utils/               Retry/backoff, batching, dimension validation
│       ├── providers/
│       │   ├── base/            Shared retry/timeout/batching/dimension-cache logic
│       │   └── qdrant/          Qdrant REST implementation + filter mapper
│       └── factory/             VectorStoreProviderFactory — config in, IVectorStore out
└── tests/
    └── vector-store/            Mirrors src/vector-store, one spec file per module
```

## Why Qdrant only, for now

Component 2's `EmbeddingProviderName` list (OpenAI, Gemini, Cohere, Ollama)
doesn't map one-to-one onto vector databases — the architecture doc names
Qdrant specifically as the platform's vector database, and it's the only
one running in `docker-compose.yml`. So unlike the LLM and embedding
layers, `VectorStoreProviderName` starts as a single-member union rather
than a pre-populated list of unimplemented vendors.

The `IVectorStore` interface and `BaseVectorStoreProvider` are written
vendor-neutral from day one — nothing about them is Qdrant-specific — so
adding Pinecone, Weaviate, or pgvector later is exactly the same
"implement `raw*`, register in the factory" exercise Component 2 documents
for embedding providers. See **Adding a new provider** below.

## Design principles applied

- **Provider Agnostic** — application code depends only on
  `IVectorStore`. `VectorStoreProviderFactory.create(config)` is the only
  place that knows about concrete vendor classes.
- **Resilience by default** — every request goes through exponential
  backoff with jitter (`retryWithBackoff`) and a per-attempt timeout. Only
  transient errors (connection failures, timeouts, 5xx) are retried;
  authentication and validation errors fail fast. Identical policy to
  Components 1 and 2.
- **Normalized errors** — Qdrant's HTTP error responses are mapped onto
  one shared `VectorStoreError` hierarchy (`VectorStoreAuthenticationError`,
  `VectorStoreConnectionError`, `VectorStoreTimeoutError`,
  `VectorStoreInvalidRequestError`, `VectorStoreNotFoundError`,
  `VectorStoreAlreadyExistsError`, `VectorStoreProviderUnavailableError`),
  plus one error unique to this layer:
  - `VectorStoreDimensionMismatchError` — the write-side counterpart to
    Component 2's `EmbeddingDimensionMismatchError`. Thrown _before_ a
    request is ever sent whenever a vector's length disagrees with its
    collection's configured size, so an embedding-model swap or a
    misdirected write fails immediately and clearly instead of silently
    corrupting search quality or surfacing as an opaque Qdrant 400 three
    layers away from the real mistake.
- **Batching-first** — `upsertBatch()` is the base primitive; `upsert()`
  is a one-item convenience wrapper over it. `BaseVectorStoreProvider`
  automatically splits larger inputs into vendor-safe chunks
  (`vendorMaxBatchSize`, 200 for Qdrant) via `chunkArray` and reassembles
  results in original input order — same pattern as Component 2's
  `embedBatch()`.
- **Dimension-safety as a first-class concern** — every collection's
  vector size is cached after its first `create`/`get` call, and every
  `upsert`/`search` validates its vector's length against that cache
  before a request is sent.
- **Local development first** — Qdrant already runs in this project's
  `docker-compose.yml` with no API key required; `apiKey` in config is
  only needed for Qdrant Cloud.

## Multi-tenancy strategy (read this before wiring up Component 4)

Principle 2 requires that no tenant can access another tenant's data. This
layer gives you the tools (`VectorFilter`, `KnowledgeVectorPayload`) but
doesn't force a topology, because the right one depends on scale:

- **Recommended default: one collection per assistant**, named e.g.
  `assistant_{assistantId}`, with `tenantId` still stored in every point's
  payload as a defense-in-depth check. This keeps collections small,
  makes "delete all of this assistant's knowledge" a single
  `deleteCollection` call, and avoids ever needing a cross-tenant filter
  to go wrong.
- **Alternative: one shared collection**, with every `search`/`count`/
  `deleteByFilter` call required to include a `must` filter on `tenantId`
  and `assistantId`. Simpler operationally at very large tenant counts
  (avoids "thousands of tiny collections"), but every call site in
  Components 4 and 5 becomes a place tenant isolation can be forgotten.

Either way, `KnowledgeVectorPayload` (in `types/vector-record.types.ts`)
is the payload shape Knowledge Chunking is expected to write and RAG
Retriever is expected to read — standardizing this now means Components 4
and 5 don't each invent their own metadata schema.

## Usage

```typescript
import { VectorStoreProviderFactory } from '@ai-chatbot-platform/ai-core';

const store = VectorStoreProviderFactory.create({
  provider: 'qdrant',
  url: process.env.QDRANT_URL ?? 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY, // omit for local/self-hosted Qdrant
});

// Create (or reuse) a collection sized for your embedding model.
// vectorSize must match Component 2's embedder.dimensions exactly.
await store.getOrCreateCollection({
  name: 'assistant_abc123',
  vectorSize: 1536, // e.g. text-embedding-3-small
});

// Upsert chunks — usually the output of Component 2's embedBatch()
await store.upsertBatch('assistant_abc123', [
  {
    id: 'chunk_1',
    vector: embeddingResult.embeddings[0].embedding,
    payload: {
      tenantId: 'tenant_1',
      assistantId: 'assistant_abc123',
      documentId: 'doc_42',
      chunkId: 'chunk_1',
      chunkIndex: 0,
      text: 'Our refund policy allows returns within 30 days...',
      sourceType: 'document',
      createdAt: new Date().toISOString(),
    },
  },
]);

// Search — usually fed by Component 2's embed() on the user's query
const results = await store.search('assistant_abc123', {
  vector: queryEmbedding,
  topK: 5,
  filter: {
    must: [{ key: 'tenantId', match: { value: 'tenant_1' } }],
  },
});
```

Reindexing a document (drop its old chunks before writing new ones):

```typescript
await store.deleteByFilter('assistant_abc123', {
  must: [{ key: 'documentId', match: { value: 'doc_42' } }],
});
```

Switching vector databases is purely config (once a second provider
exists — see below):

```typescript
const store = VectorStoreProviderFactory.create({
  provider: 'qdrant',
  url: 'https://my-cluster.cloud.qdrant.io:6333',
  apiKey: process.env.QDRANT_API_KEY,
});
```

## Adding a new provider

1. Create `src/vector-store/providers/<name>/<name>-vector-store.provider.ts`
   extending `BaseVectorStoreProvider`.
2. Implement the `raw*` primitives (`rawCreateCollection`, `rawSearch`,
   `rawUpsertBatch`, etc.) and set `vendorMaxBatchSize`.
3. Add a `<name>-filter.mapper.ts` translating `VectorFilter` into that
   vendor's query syntax (see `qdrant-filter.mapper.ts`).
4. Add `'<name>'` to `VectorStoreProviderName` in
   `types/vector-store-config.types.ts` and to
   `VECTOR_STORE_PROVIDER_NAMES` in `schemas/vector-store-config.schema.ts`.
5. Register it in `factory/vector-store-provider.factory.ts`.
6. Add a spec file under `tests/vector-store/providers/<name>/`.

No other module needs to change — `IVectorStore` and everything built on
top of it (Components 4 and 5) is unaffected.

## Wiring into your existing project

Add one line to your existing `packages/ai-core/src/index.ts`, alongside
the exports already there for Components 1 and 2:

```typescript
export * from './llm'; // Component 1 — already there
export * from './embedding'; // Component 2 — already there
export * from './vector-store'; // Component 3 — add this line
```

No new dependencies. This layer reuses `zod` (already added in Component 2) for config validation and native `fetch` (already relied on by
Components 1 and 2) for the Qdrant REST calls — no `@qdrant/js-client-rest`
or other vendor SDK.

## Environment variables

Add to `.env.example`:

```
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
```

`QDRANT_API_KEY` is only required for Qdrant Cloud; local/self-hosted
Qdrant (already in `docker-compose.yml`) needs none.

## Testing

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # jest
npm run test:coverage
```

Provider tests mock `global.fetch` — no network access or a running
Qdrant instance is needed to run the suite. Verified in this delivery: a
full strict `tsc --noEmit` pass with no errors, and all 57 tests passing
across batching, retry/backoff, dimension-safety, filter mapping, schema
validation, and the Qdrant HTTP layer.

## Known limitations (by design, for this component)

- **`deleteByFilter`'s `deletedCount` is a best-effort count, not an exact
  one.** Qdrant's delete-by-filter response doesn't report how many
  points matched ([qdrant/qdrant#5761](https://github.com/qdrant/qdrant/issues/5761)
  is an open request for this), so this layer counts matches immediately
  before deleting. Under concurrent writes to the same filter, the real
  number deleted can drift slightly from the reported count. If you need
  an exact number, call `count()` yourself inside a lock/transaction
  boundary you control.
- **Single, unnamed vector per point only.** Qdrant supports named/
  multi-vector points (e.g. separate "dense" and "sparse" vectors per
  point) for hybrid search; this component targets the simpler single-
  vector-per-collection model the platform's RAG pipeline currently
  needs. Add named-vector support to the Qdrant provider directly if a
  later component needs it — `IVectorStore` itself doesn't preclude it.
- **The dimension cache is per-provider-instance and in-memory.** It's
  populated lazily (first `upsert`/`search` on a given collection costs
  one extra `getCollectionInfo` round trip) and reset on process restart.
  This is intentional — it avoids a persistent cache going stale if a
  collection is recreated with a different size out-of-band — but it
  does mean every fresh server process pays that one lookup per
  collection it touches.
- **No payload field indexing.** Qdrant filters work without an index,
  but a payload index on `tenantId`/`assistantId` (or whatever field the
  chosen multi-tenancy strategy filters on) meaningfully speeds up
  filtered search at scale. Out of scope here — add it via Qdrant's field
  index API (`PUT /collections/{name}/index`) once Component 4/5 traffic
  patterns are known, rather than guessing which fields need it now.
- **`vendorMaxBatchSize` (200) is a conservative default**, not a Qdrant-
  enforced ceiling — Qdrant has no hard per-request point limit. Raise it
  per-instance via `maxBatchSize` in config if your indexing workload
  benefits from fewer, larger upsert requests.
- As with Components 1 and 2's retry logic, only the _initial_ request is
  retried; there's no mid-flight state to resume for a single HTTP call,
  so this is simpler than the LLM layer's streaming case, not a gap.

## Core Engine roadmap

| #   | Component                              | Status           |
| --- | -------------------------------------- | ---------------- |
| 1   | LLM Provider Layer                     | ✅ done          |
| 2   | Embedding Provider Layer               | ✅ done          |
| 3   | **Vector Store Layer (Qdrant)**        | ✅ this delivery |
| 4   | Knowledge Chunking & Processing        | next             |
| 5   | RAG Retriever Engine                   | planned          |
| 6   | Prompt Builder / Domain Guardrails     | planned          |
| 7   | Conversation Memory                    | planned          |
| 8   | AI Orchestrator (ties it all together) | planned          |

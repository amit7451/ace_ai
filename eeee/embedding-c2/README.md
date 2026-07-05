# AI Core — Embedding Provider Layer
### Core Engine Component 2 of 8 — AI Chatbot SaaS Platform

This package sits directly beside the LLM Provider Layer (Component 1) inside
`packages/ai-core/`. It provides a single, provider-agnostic interface for
turning text into vectors. Every later core engine component that deals with
knowledge — Vector Store, Knowledge Chunking, RAG Retriever — depends on
`IEmbeddingProvider`, never on a specific vendor SDK, so switching embedding
providers is a configuration change, not a code change (Principle 3 of the
architecture doc: **Provider Agnostic**).

## What's inside

```
packages/ai-core/
├── src/
│   ├── index.ts
│   ├── llm/                  (Component 1 — unchanged)
│   └── embedding/
│       ├── types/            Config, request, and response type definitions
│       ├── interfaces/       The IEmbeddingProvider contract
│       ├── schemas/          Zod validation for provider configuration
│       ├── errors/           Normalized error hierarchy + HTTP status mapping
│       ├── utils/            Retry/backoff, batching, cosine similarity, token estimation
│       ├── providers/        One folder per vendor implementation
│       │   ├── base/         Shared retry/timeout/batching/dimension-guard logic
│       │   ├── openai/
│       │   ├── gemini/
│       │   ├── cohere/
│       │   └── ollama/
│       └── factory/          EmbeddingProviderFactory — config in, IEmbeddingProvider out
└── tests/
    └── embedding/             Mirrors src/embedding, one spec file per module
```

## Why these four providers

`LLMProviderName` (Component 1) also lists Groq, OpenRouter, and Anthropic —
none of them expose a dedicated embeddings endpoint today, so they're
deliberately left out of `EmbeddingProviderName` rather than stubbed with a
method that always throws. Cohere is added instead: it isn't in the original
LLM provider list, but it's a first-class production embedding vendor with
retrieval-tuned models, and its `input_type` parameter is a good example of
the query/document asymmetry this layer models explicitly. `ollama` covers
the platform's stated embedding models — BAAI BGE, Nomic Embed, E5 — all of
which are pullable Ollama models, keeping "local development first" intact.

## Design principles applied

- **Provider Agnostic** — application code depends only on
  `IEmbeddingProvider`. `EmbeddingProviderFactory.create(config)` is the only
  place that knows about concrete vendor classes.
- **Resilience by default** — every request goes through exponential
  backoff with jitter (`retryWithBackoff`) and a per-attempt timeout. Only
  transient errors (rate limits, timeouts, 5xx) are retried; authentication
  and validation errors fail fast. Identical policy to Component 1.
- **Normalized errors** — every provider maps its own error shape onto one
  shared `EmbeddingError` hierarchy (`EmbeddingAuthenticationError`,
  `EmbeddingRateLimitError`, `EmbeddingTimeoutError`,
  `EmbeddingInvalidRequestError`, `EmbeddingProviderUnavailableError`), plus
  two errors unique to this layer:
  - `EmbeddingDimensionMismatchError` — thrown whenever a vendor's returned
    vector length disagrees with the provider's configured dimensionality.
    A vector DB collection (Component 3, Qdrant) is built around one fixed
    dimension count; a silent model swap or stale `dimensions` override
    would otherwise corrupt search quality instead of failing loudly.
  - `EmbeddingBatchSizeError` — reserved for callers that want to
    pre-validate a batch before sending it, though `embedBatch()` itself
    never throws this since it chunks automatically instead (see below).
- **Batching-first** — the embedding-layer equivalent of Component 1's
  "streaming-first". `embedBatch()` is the base primitive; `embed()` is a
  one-item convenience wrapper over it. Every provider declares its own
  `vendorMaxBatchSize`; `BaseEmbeddingProvider` automatically splits larger
  inputs into vendor-safe chunks via `chunkArray` and reassembles results in
  original input order, so calling code never has to think about it.
- **Query/document asymmetry, modeled explicitly** — `EmbeddingInputType`
  (`document | query | clustering | classification`) is a first-class
  option on every `embed()`/`embedBatch()` call, mapped to each vendor's own
  parameter name (`taskType` for Gemini, `input_type` for Cohere). Providers
  without this concept (OpenAI, Ollama) simply ignore it.
- **Local development first** — the `ollama` provider needs no API key and
  talks to a local server, so the whole layer works fully offline, same as
  Component 1's `ollama` LLM provider.
- **Dimension-safety as a first-class concern** — every provider knows its
  model's expected dimensionality (`KNOWN_DIMENSIONS` map) or accepts an
  explicit override, and every response is checked against it before being
  returned to the caller.

## Usage

```typescript
import { EmbeddingProviderFactory } from '@ai-chatbot-platform/ai-core';

const embedder = EmbeddingProviderFactory.create({
  provider: 'openai',              // or gemini | cohere | ollama
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small',
});

// Single input
const result = await embedder.embed('What is your refund policy?', { inputType: 'query' });
console.log(result.embeddings[0].embedding, result.dimensions, result.usage);

// Batch — chunked into vendor-safe request sizes automatically
const chunks = ['chunk 1 text...', 'chunk 2 text...', /* ...hundreds more */];
const batchResult = await embedder.embedBatch(chunks, { inputType: 'document' });
```

Switching providers is purely config:

```typescript
const embedder = EmbeddingProviderFactory.create({
  provider: 'ollama',
  model: 'nomic-embed-text',
  baseUrl: 'http://localhost:11434', // optional, this is the default
});
```

Comparing two vectors (e.g. for a quick relevance sanity check without a
live vector DB):

```typescript
import { cosineSimilarity } from '@ai-chatbot-platform/ai-core';

const score = cosineSimilarity(queryVector, documentVector); // -1..1
```

## Adding a new provider

1. Create `src/embedding/providers/<name>/<name>-embedding.provider.ts`
   extending `BaseEmbeddingProvider`.
2. Implement `rawEmbed(inputs, inputType)` and set `vendorMaxBatchSize`.
3. Add a `KNOWN_DIMENSIONS` map for that vendor's models.
4. Add `'<name>'` to `EmbeddingProviderName` in
   `types/embedding-config.types.ts` and to `EMBEDDING_PROVIDER_NAMES` in
   `schemas/embedding-config.schema.ts`.
5. Register it in `factory/embedding-provider.factory.ts`.
6. Add a spec file under `tests/embedding/providers/`.

No other module needs to change — that's the point of the interface.

## Environment variables

See `.env.example`. Only the variables for the provider(s) you actually use
are required; `ollama` needs none.

## Testing

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # jest
npm run test:coverage
```

Provider tests mock `global.fetch` — no network access or real API keys are
needed to run the suite. Verified in this delivery: `tsc --noEmit` passes
clean, `tsc` produces a full `dist/` with declarations, and all 58 tests
pass (~90% statement coverage).

## Known limitations (by design, for this component)

- `vendorMaxBatchSize` per provider (OpenAI 512, Gemini 100, Cohere 96,
  Ollama 50) is a conservative default chosen for predictable latency and
  payload size, not always the vendor's absolute documented ceiling (OpenAI
  technically allows up to 2048 inputs/request). Raise it per-instance via
  `maxBatchSize` in config if your workload benefits from larger calls.
- Gemini and Ollama's embedding endpoints don't return real token usage;
  `usage` for those providers falls back to the same `chars / 4` heuristic
  used in `estimateTokens` (Component 1's known limitation, carried over
  here for the same reason). OpenAI and Cohere return real counts.
- `embedBatch()` does not deduplicate or cache repeated inputs. Caching
  identical chunks (e.g. re-embedding unchanged documents on a recrawl) is
  left to the Knowledge Chunking pipeline (Component 4), which has the
  context (content hashes, last-modified timestamps) to do it correctly.
- As with Component 1's retry logic, only the *initial* request is retried;
  there is no mid-flight state to retry for a single embeddings HTTP call,
  so this is simpler than the streaming case, not a gap.

## Core Engine roadmap

| # | Component | Status |
|---|-----------|--------|
| 1 | LLM Provider Layer | ✅ done |
| 2 | **Embedding Provider Layer** | ✅ this delivery |
| 3 | Vector Store Layer (Qdrant) | next |
| 4 | Knowledge Chunking & Processing | planned |
| 5 | RAG Retriever Engine | planned |
| 6 | Prompt Builder / Domain Guardrails | planned |
| 7 | Conversation Memory | planned |
| 8 | AI Orchestrator (ties it all together) | planned |

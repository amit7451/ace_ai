# AI Core — Knowledge Chunking & Processing
### Core Engine Component 4 of 8 — AI Chatbot SaaS Platform

This package sits directly beside the LLM Provider Layer (Component 1),
Embedding Provider Layer (Component 2), and Vector Store Layer (Component 3)
inside `packages/ai-core/`. It turns raw uploaded/crawled content into the
`KnowledgeChunk[]` that Components 2 and 3 expect: text short enough to
embed well, tagged with tenant/document metadata, in a shape that maps
directly onto Component 3's `KnowledgeVectorPayload`.

Architecture doc's pipeline, in this package's terms:

```
Extract → Clean → Chunk → Embed → Index
 (parse)   (parse)  (this)  (Comp 2) (Comp 3)
```

## What's inside

```
packages/ai-core/
├── src/
│   ├── llm/                    (Component 1 — unchanged)
│   ├── embedding/               (Component 2 — unchanged)
│   ├── vector-store/            (Component 3 — unchanged)
│   └── knowledge/
│       ├── types/               Config, document, and chunk type definitions
│       ├── interfaces/          The IDocumentParser and IChunkingStrategy contracts
│       ├── schemas/             Zod validation for processing config
│       ├── errors/               Normalized error hierarchy (no HTTP mapping — see below)
│       ├── utils/                Text cleaning, recursive splitter, CSV tokenizer, deterministic IDs
│       ├── parsers/
│       │   ├── base/             Shared empty-content guard
│       │   ├── plain-text/
│       │   ├── markdown/         Header-tree extraction for structure-aware chunking
│       │   ├── html/             Tag stripping + entity decoding
│       │   └── csv/              Header-mapped row extraction
│       ├── chunking/
│       │   ├── base/             Shared options validation
│       │   ├── fixed-size/       Sliding window, word-boundary aware
│       │   ├── recursive/        Paragraph → line → sentence → word fallback (the general-purpose default)
│       │   ├── markdown-aware/   Splits by header, prefixes each chunk with its breadcrumb
│       │   └── csv-row/          One (or N) CSV rows per chunk
│       ├── factory/               DocumentParserFactory + ChunkingStrategyFactory
│       └── processor/             KnowledgeProcessor — the façade most callers use
└── tests/
    └── knowledge/                Mirrors src/knowledge, one spec file per module
```

## Why this component looks different from Components 1-3

Components 1-3 are all "one interface, several vendor implementations
behind a factory, talking to an HTTP API." This component doesn't talk to
any network at all — it's pure, synchronous, CPU-bound text processing —
and it has two independent axes (which **format** to parse, which
**strategy** to chunk with) instead of one. Concretely, that means:

- **Two factories, not one.** `DocumentParserFactory` (by format) and
  `ChunkingStrategyFactory` (by strategy name) are independent — any parser
  can in principle feed any strategy. `KnowledgeProcessor` picks sensible
  per-format defaults for you (see below) but you can always override
  either independently.
- **No retry/backoff/timeout utilities.** There's no HTTP call to retry.
  The equivalent discipline here is `BaseDocumentParser`/
  `BaseChunkingStrategy` failing fast on bad input/config via the
  `KnowledgeError` hierarchy — validation-first instead of resilience-first.
- **Chunk size is measured in characters, not tokens.** Reaching for a real
  tokenizer here would mean a new dependency (`tiktoken` or similar) just
  for a size heuristic one layer before the actual token-aware call
  (Component 2's `embed`/`embedBatch`, which reports real usage from the
  vendors that provide it). Characters are dependency-free, fast, and
  "close enough" for controlling chunk size; `KnowledgeChunk.tokenCount` is
  still reported (via the same `chars / 4` heuristic as Components 1 and
  2) so a caller can sanity-check before batching into `embedBatch`.

## Why these four formats

The architecture doc's Phase 3 also names PDF and DOCX parsers. Both are
binary formats that need a real extraction library (`pdf-parse`,
`mammoth`) — a different kind of dependency than anything Components 1-3
introduced (native `fetch` only, no vendor SDKs). Rather than break that
zero-dependency posture, this component expects PDF/DOCX to already be
extracted to plain text upstream (e.g. in `apps/worker`, right where those
extraction libraries would need to live anyway) and handed in as
`RawDocumentInput.content` with `mimeType: 'text/plain'` or a `.txt`-like
`fileName` — at that point `PlainTextParser` (or `recursive` chunking
directly) handles it exactly like any other text source. Adding native
PDF/DOCX support later is the same "extend the union, add a schema enum
entry, add a factory case" exercise as any other extension point here.

CSV gets first-class treatment (its own parser *and* its own chunking
strategy) because the product vision explicitly names FAQs and structured
company data as a knowledge source, and row-level chunking meaningfully
beats treating a spreadsheet as an undifferentiated blob of prose.

## Design principles applied

- **Provider Agnostic** — application code depends only on
  `IDocumentParser` / `IChunkingStrategy` (or just `KnowledgeProcessor`,
  which composes both). `DocumentParserFactory` and
  `ChunkingStrategyFactory` are the only places that know about concrete
  classes.
- **Structural awareness over blob-of-text chunking** — `MarkdownParser`
  and `CsvParser` expose real document structure (`DocumentStructureHint`:
  a header tree, a row list) that `markdown-aware` and `csv-row`
  strategies use directly, instead of every format collapsing to
  undifferentiated text before chunking even starts. This is what lets a
  markdown chunk carry its section breadcrumb ("Getting Started >
  Installation") as embedded context, and what keeps one FAQ's Q&A pair
  from being merged into its neighbor's chunk.
- **Deterministic, idempotent chunk IDs** — `chunkId` is a UUIDv5 derived
  from `${documentId}:${chunkIndex}` (see `utils/id-generation.ts`), not a
  random UUID. Reprocessing the same document with the same chunking
  config regenerates the exact same IDs, so re-running "Reindexing"
  (architecture doc, Phase 3) after a document is edited or a site is
  re-crawled overwrites the same Qdrant points (Component 3) instead of
  accumulating duplicates on every pass. The output is also a spec-valid
  UUID string, which is what Qdrant's point-ID validation actually
  requires — a raw content hash would not pass it.
- **Direct compatibility with Component 3** — `KnowledgeChunk`'s core
  fields (`tenantId`, `assistantId`, `documentId`, `chunkId`, `chunkIndex`,
  `text`, `sourceType`, `createdAt`) match Component 3's
  `KnowledgeVectorPayload` usage example field-for-field.
  `toKnowledgeVectorPayload()` does the mapping in one call, nesting any
  strategy-specific `metadata` (header path, CSV row range) under its own
  key so it can never collide with a core field.
- **Validation-first, not resilience-first** — every parser and strategy
  validates its input/config before doing any real work
  (`BaseDocumentParser`'s empty-content guard,
  `BaseChunkingStrategy`'s options validation) and fails with a specific
  `KnowledgeError` subclass rather than producing a garbage chunk.
- **Zero new runtime dependencies** — `zod` (already used by Components
  2-3) is the only one. Markdown/HTML/CSV parsing and the recursive
  splitter are all hand-rolled with regex/string operations rather than
  pulling in `remark`, `cheerio`, or `papaparse` — same "native tools
  only" posture Components 1-3 established for HTTP (native `fetch`).

## Usage

```typescript
import { KnowledgeProcessor, toKnowledgeVectorPayload } from '@ai-chatbot-platform/ai-core';
import { EmbeddingProviderFactory } from '@ai-chatbot-platform/ai-core'; // Component 2
import { VectorStoreProviderFactory } from '@ai-chatbot-platform/ai-core'; // Component 3

const processor = new KnowledgeProcessor();

// format/strategy/sourceType are all optional — inferred from fileName/mimeType
// and sensible per-format defaults when omitted.
const chunks = processor.process(
  {
    content: markdownFileContents,
    fileName: 'refund-policy.md',
  },
  {
    tenantId: 'tenant_1',
    assistantId: 'assistant_abc123',
    documentId: 'doc_42',
  },
);

// Feed straight into Component 2, then Component 3:
const embedder = EmbeddingProviderFactory.create({ provider: 'openai', apiKey: process.env.OPENAI_API_KEY!, model: 'text-embedding-3-small' });
const store = VectorStoreProviderFactory.create({ provider: 'qdrant', url: process.env.QDRANT_URL });

const embeddingResult = await embedder.embedBatch(chunks.map((c) => c.text), { inputType: 'document' });

await store.upsertBatch(
  'assistant_abc123',
  chunks.map((chunk, i) => ({
    id: chunk.chunkId,
    vector: embeddingResult.embeddings[i].embedding,
    payload: toKnowledgeVectorPayload(chunk),
  })),
);
```

Reindexing after an edit is just calling `process()` again with the same
`documentId` — the regenerated `chunkId`s land on the same Qdrant points:

```typescript
const updatedChunks = processor.process({ content: updatedMarkdown, fileName: 'refund-policy.md' }, {
  tenantId: 'tenant_1',
  assistantId: 'assistant_abc123',
  documentId: 'doc_42', // same documentId as before
});
// upsertBatch with these chunks overwrites, it doesn't duplicate.
```

Overriding format/strategy/chunk sizing explicitly instead of relying on
inference and defaults:

```typescript
const chunks = processor.process(
  { content: faqCsvContents },
  {
    tenantId: 'tenant_1',
    assistantId: 'assistant_abc123',
    documentId: 'doc_faq',
    format: 'csv',
    strategy: 'csv-row',
    chunking: { rowsPerChunk: 1 },
    sourceType: 'faq',
  },
);
```

## Adding a new format or strategy

**New format:**
1. Create `src/knowledge/parsers/<name>/<name>.parser.ts` extending
   `BaseDocumentParser`, implementing `rawParse`.
2. Add `'<name>'` to `DocumentFormat` in `types/knowledge-config.types.ts`
   and to `KNOWLEDGE_DOCUMENT_FORMATS` in
   `schemas/knowledge-config.schema.ts`.
3. Register it in `factory/document-parser.factory.ts`.
4. Optionally add entries to `DEFAULT_STRATEGY_BY_FORMAT`,
   `DEFAULT_SOURCE_TYPE_BY_FORMAT`, and `DEFAULT_CHUNKING_BY_FORMAT` in
   `processor/knowledge-processor.ts`, and to `inferFormat`'s mimeType/
   extension checks.
5. Add a spec file under `tests/knowledge/parsers/`.

**New strategy:**
1. Create `src/knowledge/chunking/<name>/<name>-chunking.strategy.ts`
   extending `BaseChunkingStrategy`, implementing `rawChunk`.
2. Add `'<name>'` to `ChunkingStrategyName` in
   `types/knowledge-config.types.ts` and to `CHUNKING_STRATEGY_NAMES` in
   `schemas/knowledge-config.schema.ts`.
3. Register it in `factory/chunking-strategy.factory.ts`.
4. Add a spec file under `tests/knowledge/chunking/`.

No other module needs to change — `KnowledgeProcessor` and everything
built on top of it (Component 5) is unaffected.

## Wiring into your existing project

Add one line to your existing `packages/ai-core/src/index.ts`, alongside
the exports already there for Components 1-3:

```typescript
export * from './llm';          // Component 1 — already there
export * from './embedding';    // Component 2 — already there
export * from './vector-store'; // Component 3 — already there
export * from './knowledge';    // Component 4 — add this line
```

No new dependencies — `zod` is already in `packages/ai-core/package.json`
from Component 2/3.

## Testing

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # jest
npm run test:coverage
```

Nothing here talks to the network or a database, so there's nothing to
mock — every test runs against real parsing/chunking logic. Verified in
this delivery: a full strict `tsc --noEmit` pass with no errors, a clean
`tsc` build producing 33 declaration files, and all 109 tests passing
(~97% statement coverage) across text cleaning, the recursive splitter,
the CSV tokenizer, deterministic ID generation, all four parsers, all four
chunking strategies, both factories, and the end-to-end processor
(including an explicit idempotent-reindexing test: processing the same
document twice yields identical chunk IDs).

## Known limitations (by design, for this component)

- **Markdown/HTML parsing is regex-based, not a full CommonMark/DOM
  parser.** Handles the common subset (headers, emphasis, links, images,
  code fences, lists, blockquotes for markdown; tag stripping and entity
  decoding for HTML) — not tables, footnotes, or arbitrary raw HTML with
  heavy scripting. For HTML specifically, this is intentional: per the
  architecture doc's crawler stack (Playwright, Cheerio, **Readability**),
  the website crawler already extracts clean article content upstream
  before this layer ever sees it.
- **Chunk size is in characters, not tokens** (see "Why this component
  looks different," above) — a deliberate dependency tradeoff, not an
  oversight.
- **The sentence splitter is a lightweight heuristic**, not an NLP
  tokenizer — a short curated abbreviation list (Mr., Dr., etc.) avoids
  the most common false splits, but isn't exhaustive. Since chunks are
  greedily merged back up to `maxChunkSize` regardless of exactly where
  sentence boundaries fall, an occasional extra split is harmless.
- **No cross-document deduplication or content-based caching.** Two
  different documents with identical text produce two separate sets of
  chunks (correctly — they have different `documentId`s and therefore
  different `chunkId`s). Recognizing that identical *content* doesn't need
  re-embedding is a cost optimization better placed in the caller (e.g. a
  content-hash check in `apps/worker` before ever calling `process()`),
  which has visibility into crawl/upload history this layer doesn't.
- **PDF and DOCX are out of scope for this delivery** — see "Why these
  four formats," above, for the reasoning and the extension path.

## Core Engine roadmap

| # | Component | Status |
|---|-----------|--------|
| 1 | LLM Provider Layer | ✅ done |
| 2 | Embedding Provider Layer | ✅ done |
| 3 | Vector Store Layer (Qdrant) | ✅ done |
| 4 | **Knowledge Chunking & Processing** | ✅ this delivery |
| 5 | RAG Retriever Engine | next |
| 6 | Prompt Builder / Domain Guardrails | planned |
| 7 | Conversation Memory | planned |
| 8 | AI Orchestrator (ties it all together) | planned |

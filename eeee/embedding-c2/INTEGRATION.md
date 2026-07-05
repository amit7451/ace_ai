# Integrating into your existing `packages/ai-core`

This delivery is self-contained on purpose — it doesn't import anything from
`src/llm/`, so it can be dropped in without touching Component 1's code. It
does duplicate a couple of small utilities (`retryWithBackoff`, error-mapper
pattern) rather than reach into `llm/utils` internals it can't see from here.
If you'd rather share one copy of those across both modules, see "Optional:
de-duplicating shared utilities" at the end.

## 1. Copy the source and tests

From this package's root, copy into your monorepo:

```bash
cp -r src/embedding      <your-repo>/packages/ai-core/src/embedding
cp -r tests/embedding     <your-repo>/packages/ai-core/tests/embedding
```

Your `packages/ai-core/src/` should now look like:

```
src/
├── index.ts
├── llm/            (Component 1, untouched)
└── embedding/       (new)
```

## 2. Update the package-level barrel export

In `packages/ai-core/src/index.ts`, add:

```typescript
export * from './embedding';
```

alongside whatever already exports `./llm`.

## 3. Dependencies

`zod` is the only runtime dependency, and Component 1 already uses it for
its own schema validation — so `packages/ai-core/package.json` almost
certainly already lists it. Double check the version constraint is
compatible (`^3.x`); nothing here uses anything from a specific 3.x minor.

Dev dependencies (`typescript`, `jest`, `ts-jest`, `@types/jest`,
`@types/node`) should also already be present at the ai-core package level
or the monorepo root — no new devDependencies are introduced.

## 4. Environment variables

Merge `.env.example` from this delivery into the existing one. `OPENAI_API_KEY`
and `GEMINI_API_KEY` are almost certainly already defined for Component 1 —
reuse the same variables/keys, they work for both chat completions and
embeddings on both vendors. Only `COHERE_API_KEY` and `OLLAMA_EMBED_MODEL`
are new.

## 5. Run it

From the ai-core package root:

```bash
npm run typecheck
npm test
```

Both should pass with no other changes — that was verified standalone in
this delivery (`tsc --noEmit` clean, 58/58 tests passing, ~90% coverage)
using the same jest/ts-jest/tsconfig conventions Component 1 already
established.

## Optional: de-duplicating shared utilities

`embedding/utils/retry.ts` and `embedding/errors/error-mapper.ts` are
structurally identical in spirit to their `llm/` counterparts (exponential
backoff with jitter; HTTP-status-to-normalized-error mapping) but are not
literally the same code, since this delivery couldn't see Component 1's
actual source — only its README. If, once merged, the two turn out to be
close enough to unify:

1. Move the retry logic to `packages/ai-core/src/shared/retry.ts` (or
   `packages/shared` if you want it usable outside ai-core too).
2. Keep two thin error-mapper files (`llm` errors vs `embedding` errors are
   different classes) but have both call into one shared
   `mapHttpStatusToDomainError(ErrorCtors, status, ...)` helper if the
   status-code-to-category logic is truly identical.
3. Update imports in both `llm/providers/base/` and
   `embedding/providers/base/` accordingly, then re-run both test suites.

This is a nice-to-have cleanup, not a correctness issue — leaving both
copies in place works fine and keeps each component independently
reviewable, which is arguably preferable for a portfolio/audit trail like
this project's.

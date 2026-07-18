# Crawler Feature — Integration Notes

This delivers the crawler end to end: engine → worker pipeline → API → dashboard UI.
Every path below matches your monorepo exactly — drop each file in at that path.

## What's genuinely verified vs. what isn't

**`packages/crawler` is fully verified**, not just written: installed standalone, `tsc --noEmit`
clean, 58 tests passing (`npm test`), and — because mocks lie about things like DNS/TLS/redirect
behavior — I also smoke-tested `safe-fetch.ts` against real servers (`raw.githubusercontent.com`,
`github.com`'s http→https redirect). That smoke test caught one real bug before it shipped:
Node's Happy-Eyeballs connection path calls a custom `lookup` function with `{ all: true }` and
expects an array-form callback, not the classic `(err, address, family)` triple — silently
producing `ERR_INVALID_IP_ADDRESS` if you don't handle both forms. It's fixed in `safe-fetch.ts`;
worth knowing about if you ever touch that file.

**Everything downstream of the crawler engine (worker pipeline, API layer, schema, UI) is
carefully hand-written against your exact pasted files, but not compiled** — this sandbox can't
reach `binaries.prisma.sh` to generate your Prisma client, so I couldn't `tsc`/run these against
your real dependency graph. Run `pnpm typecheck` after dropping them in; I'd be surprised by
much, but I'd rather say that plainly than imply a false level of certainty.

## 1. Database — additive migration

`packages/database/prisma/schema.prisma` is your exact current file with additions marked
`// NEW`: `CrawlJob` gains config fields (maxPages, maxDepth, includePaths, excludePaths,
respectRobotsTxt, sameOriginOnly) and progress fields (pagesDiscovered, pagesFailed); a new
`CrawledPage` model tracks one row per URL visited (so a dev can see _which_ pages made it in and
why any didn't — robots.txt, 404, timeout, non-HTML — not just an opaque pass/fail count);
`KnowledgeSource` gains a back-relation. Deleting a `CrawlJob` cascades its `CrawledPage` rows but
`SetNull`s the `KnowledgeSource` link — deleting crawl history never deletes knowledge already
in production use by the chatbot.

```
cd packages/database
npx prisma migrate dev --name add_crawler_pages
```

## 2. `packages/crawler` — new package

Copy the whole `packages/crawler` folder in as-is (it doesn't exist in your repo yet). Then:

```
pnpm install   # picks up the new @ion-ai/crawler workspace package + its two new deps
```

New dependencies: `cheerio` (already yours), `robots-parser` (new — small, no native deps, CJS,
no bundled types so I included a minimal `.d.ts` for it).

## 3. Worker

- `apps/worker/src/pipeline/crawler.pipeline.ts` — new file.
- `apps/worker/src/lib/resolve-embedding-provider.ts` — new file. Pulled the embedding-provider
  resolution logic out of your updated `ingestion.pipeline.ts` verbatim (including the `'testing'`
  provider escape hatch) so both pipelines resolve org config identically. I did **not** touch
  `ingestion.pipeline.ts` itself — refactoring it to call this same helper is an optional,
  zero-risk follow-up whenever you want it, not something I changed out from under you.
- `apps/worker/src/worker.ts` — replace with the version here. It adds a second BullMQ `Worker`
  for `QueueName.CRAWLER` alongside your existing ingestion one, at `concurrency: 2` (deliberately
  lower than ingestion's 5 — each crawl job already fans out its own internal page-fetch
  concurrency, so this bounds how many _whole crawls_ run at once platform-wide, not how many
  HTTP requests are in flight).
- `apps/worker/package.json` — add the one dependency line (`"@ion-ai/crawler": "workspace:*"`)
  to your real current file; I've included a full file based on the version you showed me
  earlier, but if it's since changed, just add that one line rather than overwriting yours.

## 4. API

- `packages/contracts/index.ts` — your exact current file plus `CreateCrawlJobRequestSchema`
  appended at the bottom.
- `apps/api/src/repositories/CrawlerRepository.ts` — extends yours; all existing method
  signatures (`findById`, `findManyByOrganizationId`, `create`, `updateStatus`) are unchanged,
  so nothing else that calls this repo breaks.
- `apps/api/src/services/CrawlerService.ts` — extends yours; `getCrawlers` and `retryCrawler`
  behave exactly as before (same signatures, same audit-log actions), plus `createCrawlJob`,
  `getCrawler`, `cancelCrawler`, `deleteCrawler`. `createCrawlJob` and `deleteCrawler` require
  `EDITOR` role or above via `hasPermission` — worth doing given this endpoint fetches arbitrary
  URLs server-side; your `KnowledgeController` doesn't currently gate uploads this way, so this is
  slightly stricter than your existing convention, on purpose.
- `apps/api/src/controllers/CrawlerController.ts` — full rewrite: `GET /`, `GET /:id`, `POST /`
  (Zod-validated), `POST /:id/retry` (unchanged), `POST /:id/cancel`, `DELETE /:id`, and
  `GET /:id/stream` (SSE, mirroring your `JobController`'s `/stream` pattern, plus interval
  polling — BullMQ's `QueueEvents` only fires on job-level transitions, and a single crawl can run
  for minutes with dozens of page-level updates in between).
- `apps/api/src/di.ts` — **no change needed.** You'd already wired `crawlerRepository`/
  `crawlerService` with the exact constructor shape this expects.
- Confirm `@ion-ai/crawler` and `@ion-ai/auth` (for `Role`/`hasPermission`, likely already a
  dependency given `ConfigurationController` uses it) are in `apps/api/package.json`.

## 5. Dashboard

- `apps/dashboard/app/(dashboard)/crawlers/page.tsx` — list + create form (URL plus a collapsed
  "advanced options" section: max pages/depth, include/exclude path patterns, robots.txt and
  same-origin toggles). Polls every 3s while any job is PENDING/RUNNING.
- `apps/dashboard/app/(dashboard)/crawlers/[id]/page.tsx` — new detail route: live per-page table
  via the SSE endpoint, cancel/retry/delete actions.
- Both use `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'` instead of a hardcoded
  URL — set `NEXT_PUBLIC_API_URL` for anything beyond local dev.
- Not done: pre-emptively hiding the Add/Cancel/Delete buttons for VIEWER-role members (like your
  `members/page.tsx` does with `canManage`). I don't know your convention for resolving the
  current member's role client-side, so this relies on the API's 403 rather than hiding the UI in
  advance — a small, easy follow-up once you point me at how that's fetched elsewhere.

## Production-grade specifics worth knowing about

- **SSRF protection is real, not a note in a comment.** Every request — including every redirect
  hop, including the robots.txt fetch itself — resolves DNS and validates the address immediately
  before connecting, using a custom Node `lookup` function so the validated address and the
  connected address are provably the same one (closes the DNS-rebinding TOCTOU gap a naive
  "check-then-fetch" approach leaves open). Private/reserved ranges, loopback, link-local
  (including the `169.254.169.254` cloud metadata address), and `localhost` are all blocked, at
  creation time _and_ at crawl time.
- **One bad page never kills the crawl.** Fetch failures, embedding failures, and R2 failures are
  caught per-page; the job only fails outright if something structural breaks (can't resolve the
  embedding provider, can't reach Qdrant).
- **Retries resume rather than restart.** Pages already successfully ingested are re-fetched (to
  rediscover their links) but never re-embedded — a crawl that fails on page 40 of 50 doesn't cost
  you 40 pages of re-embedding on retry.
- **Politeness is real**, not just a rate-limit-shaped comment: a minimum delay between requests
  to the same host, sourced from robots.txt `Crawl-delay` when present.
- Page content is converted to lightly-structured Markdown before chunking (headings preserved),
  so it goes through `ai-core`'s markdown-aware chunker rather than being treated as one
  undifferentiated blob of text — better retrieval quality for long pages.

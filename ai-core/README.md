# AI Core — LLM Provider Layer
### Core Engine Component 1 of 8 — AI Chatbot SaaS Platform

This package is the foundation of the platform's "core engine": a single,
provider-agnostic interface for calling any supported LLM. Every later core
engine component (retriever, prompt builder, orchestrator, etc.) will depend
on `ILLMProvider` — never on a specific vendor SDK — so switching providers
is a configuration change, not a code change (Principle 3 of the
architecture doc: **Provider Agnostic**).

## What's inside

```
packages/ai-core/
├── src/
│   ├── index.ts
│   └── llm/
│       ├── types/            Message, config, and response type definitions
│       ├── interfaces/       The ILLMProvider contract
│       ├── schemas/          Zod validation for provider configuration
│       ├── errors/           Normalized error hierarchy + HTTP status mapping
│       ├── utils/            Retry/backoff, SSE/NDJSON stream parsing, token estimation
│       ├── providers/        One folder per vendor implementation
│       │   ├── base/         Shared retry/timeout/header logic
│       │   ├── openai/
│       │   ├── anthropic/
│       │   ├── gemini/
│       │   ├── groq/         (extends OpenAIProvider — OpenAI-compatible API)
│       │   ├── openrouter/   (extends OpenAIProvider — OpenAI-compatible API)
│       │   └── ollama/
│       └── factory/          LLMProviderFactory — config in, ILLMProvider out
└── tests/                    Mirrors src/, one spec file per module
```

## Design principles applied

- **Provider Agnostic** — application code depends only on `ILLMProvider`.
  `LLMProviderFactory.create(config)` is the only place that knows about
  concrete vendor classes.
- **Resilience by default** — every request goes through exponential
  backoff with jitter (`retryWithBackoff`) and a per-attempt timeout. Only
  transient errors (rate limits, timeouts, 5xx) are retried; authentication
  and validation errors fail fast.
- **Normalized errors** — every provider maps its own error shape onto one
  shared `LLMError` hierarchy (`LLMAuthenticationError`, `LLMRateLimitError`,
  `LLMTimeoutError`, `LLMInvalidRequestError`, `LLMProviderUnavailableError`,
  `LLMContextLengthError`), so upstream code (the future AI Orchestrator)
  never has to branch on vendor-specific error formats.
- **Streaming-first** — `stream()` returns an `AsyncGenerator`, ready to be
  piped straight into an SSE response for the widget/dashboard.
- **Local development first** — the `ollama` provider needs no API key and
  talks to a local server, so the whole layer works fully offline.
- **DRY across OpenAI-compatible vendors** — Groq and OpenRouter both speak
  the OpenAI Chat Completions wire format, so they simply extend
  `OpenAIProvider` and override the base URL rather than duplicating
  request/response handling.

## Usage

```typescript
import { LLMProviderFactory } from '@ai-chatbot-platform/ai-core';

const provider = LLMProviderFactory.create({
  provider: 'openai',        // or anthropic | gemini | groq | openrouter | ollama
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
});

// Non-streaming
const result = await provider.complete([
  { role: 'system', content: 'You are a support assistant for Acme Inc.' },
  { role: 'user', content: 'What is your refund policy?' },
]);
console.log(result.content, result.usage);

// Streaming (e.g. piped into an SSE response)
for await (const chunk of provider.stream([{ role: 'user', content: 'Hi!' }])) {
  process.stdout.write(chunk.delta);
}
```

Switching providers is purely config:

```typescript
const provider = LLMProviderFactory.create({
  provider: 'ollama',
  model: 'llama3',
  baseUrl: 'http://localhost:11434', // optional, this is the default
});
```

## Adding a new provider

1. Create `src/llm/providers/<name>/<name>.provider.ts` extending
   `BaseLLMProvider` (or `OpenAIProvider` if the API is OpenAI-compatible).
2. Implement `complete`, `stream`, and `healthCheck`.
3. Add `'<name>'` to `LLMProviderName` in `types/llm-config.types.ts` and to
   `LLM_PROVIDER_NAMES` in `schemas/llm-config.schema.ts`.
4. Register it in `factory/llm-provider.factory.ts`.
5. Add a spec file under `tests/llm/providers/`.

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
needed to run the suite.

## Known limitations (by design, for this component)

- Retry/timeout wraps the *initial* request only; a network failure
  mid-stream is surfaced to the caller rather than silently retried, since
  partially-yielded content can't be safely replayed at this layer.
- `estimateTokens` is a cheap heuristic (`chars / 4`) for pre-flight budget
  checks, not a real tokenizer. Always prefer `LLMResponse.usage` when
  accuracy matters (billing, hard context-window enforcement).
- Tool/function calling is modeled in the types (`LLMToolDefinition`,
  `LLMToolCall`) and wired into the OpenAI-compatible providers, but
  Anthropic/Gemini tool-call parsing is left for a follow-up pass once the
  AI Orchestrator (Component 8) defines how tools are actually dispatched.

## Core Engine roadmap

| # | Component | Status |
|---|-----------|--------|
| 1 | **LLM Provider Layer** | ✅ this delivery |
| 2 | Embedding Provider Layer | next |
| 3 | Vector Store Layer (Qdrant) | planned |
| 4 | Knowledge Chunking & Processing | planned |
| 5 | RAG Retriever Engine | planned |
| 6 | Prompt Builder / Domain Guardrails | planned |
| 7 | Conversation Memory | planned |
| 8 | AI Orchestrator (ties it all together) | planned |

# 🧠 ION AI Core Engine (@ai-chatbot-platform/ai-core)

A production-grade, highly modular, and provider-agnostic AI engine for building multi-tenant SaaS chatbots.

The `ai-core` package is the "brain" of the ION AI Chatbot Platform. It orchestrates LLMs, vector databases, knowledge ingestion, RAG retrieval, and conversation memory through clean, interface-driven layers.

---

## ✨ Key Features

- **🔌 Provider Agnostic:** Swap LLMs or Vector DBs with a single config change. No vendor lock-in.
- **🛡️ Enterprise Grade:** Native multi-tenant isolation (`tenantId`/`assistantId`) baked into the retrieval and vector store layers.
- **🪶 Ultra Lightweight:** Zero heavy SDKs. The only production dependency is `zod` for strict runtime validation. Native `fetch` is used for all API calls.
- **🧱 Interface-Driven:** Every layer is abstracted behind clean interfaces and instantiated via Factory patterns.
- **🚦 Built-in Guardrails:** Out-of-domain detection prevents the AI from answering off-topic questions, saving tokens and protecting brand reputation.
- **🧪 Highly Testable:** Designed with constructor injection. Over 380+ unit tests across 60+ suites.

---

## 🏗️ Architecture: The 8 Components

The engine is divided into 8 distinct, composable components:

### 1. LLM Provider Layer (`src/llm`)

A unified interface (`ILLMProvider`) for chatting and streaming with large language models.

- **Supported Providers:** OpenAI, Gemini, Anthropic (Claude), Groq, OpenRouter, and local Ollama models.
- **Features:** Streaming support (SSE & NDJSON), token estimation, automatic retry with exponential backoff + jitter, normalized error handling.

### 2. Embedding Provider Layer (`src/embedding`)

Translates text into vector embeddings (`IEmbeddingProvider`).

- **Supported Providers:** OpenAI, Gemini, Cohere, Ollama.
- **Features:** Automatic batching, retry logic, dimension verification, cosine/dot/euclidean math utilities.

### 3. Vector Store Layer (`src/vector-store`)

Abstracts the vector database (`IVectorStore`) for storing and searching embeddings.

- **Supported Providers:** Qdrant.
- **Features:** Collection lifecycle management, multi-tenant payload structures, complex filtering (must/should/mustNot), and dimension mismatch protection.

### 4. Knowledge Chunking & Processing (`src/knowledge`)

The document ingestion pipeline (`KnowledgeProcessor`).

- **Parsers:** Plain Text, Markdown, HTML, CSV.
- **Strategies:** Fixed-size, Recursive, Markdown-aware, CSV-row.
- **Features:** Extracts metadata, cleans text, and chunks documents intelligently based on the source format.

### 5. RAG Retriever Engine (`src/retriever`)

The "Retrieval" in RAG (`IRetriever`). Converts a user query into ranked, relevant knowledge chunks.

- **Rerank Strategies:** Similarity Threshold (default), MMR (Maximal Marginal Relevance) for diversity.
- **Features:** Injects multi-tenant filters automatically, dedups exact matches, trims context to fit token budgets, and flags queries as `isRelevant: false` if no good chunks are found.

### 6. Prompt Builder & Guardrails (`src/prompt`)

Assembles the final prompt for the LLM (`IPromptBuilder`).

- **Features:** Dynamically merges the system prompt, conversation history, and RAG context.
- **Guardrails:** If the Retriever flags a query as irrelevant, the Prompt Builder triggers a `FallbackStrategy` (e.g., instructing the LLM to politely decline, or short-circuiting with an `OutOfDomainError`).

### 7. Conversation Memory (`src/memory`)

Manages chat history across turns (`IMemoryProvider`).

- **Supported Providers:** In-Memory (with TTL support). _Redis coming soon._
- **Features:** Auto-prunes old messages to respect context limits, extends TTL on reads.

### 8. AI Orchestrator (`src/orchestrator`)

The top-level façade (`IAIOrchestrator`) that ties Components 1-7 together into a single `chat()` endpoint.

- **Pipeline:** Validates Request → Retrieves Context → Fetches History → Builds Prompt → Executes LLM → Persists Memory → Returns Response.

---

## 💻 Usage Example

Wiring up the engine is simple using the provided factories. Here is a complete end-to-end RAG chat execution:

```typescript
import 'dotenv/config';
import { LLMProviderFactory } from './ai-core/src/llm';
import { InMemoryMemoryProvider } from './ai-core/src/memory';
import { RagPromptBuilder } from './ai-core/src/prompt';
import { RagOrchestrator } from './ai-core/src/orchestrator';

// 1. Initialize Memory
const memory = new InMemoryMemoryProvider({ provider: 'in-memory', ttlSeconds: 3600 });

// 2. Initialize Prompt Builder with Guardrails
const promptBuilder = new RagPromptBuilder({
  systemPrompt: 'You are a helpful customer support assistant for ACME Corp.',
  contextTemplate: 'Use the following context to answer:\n\n{context}',
  domainScope: 'ACME Corp products, services, billing, and support',
  fallbackStrategy: 'instruct_llm',
  maxHistoryMessages: 10,
});

// 3. Initialize LLM
const llm = LLMProviderFactory.create({
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  apiKey: process.env.GEMINI_API_KEY!,
});

// 4. Initialize Retriever (Mocked here for brevity, normally uses RagRetriever)
const retriever = /* create RagRetriever with Embeddings and VectorStore */;

// 5. Create Orchestrator
const orchestrator = new RagOrchestrator(llm, retriever, promptBuilder, memory);

// 6. Execute Chat
const response = await orchestrator.chat({
  tenantId: 'tenant-123',
  assistantId: 'assistant-456',
  sessionId: 'session-789',
  query: 'What is your refund policy?'
});

console.log(response.content);
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and configure your API keys.

```env
# LLM Providers
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant...

# Vector Store
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=...

# See .env.example for full list of defaults (Thresholds, Top-K, Token Limits, etc.)
```

---

## 🚀 Development & Testing

The project uses strict TypeScript (ES2022) and Jest for testing.

```bash
# Install dependencies
npm install

# Type check
npm run typecheck

# Run unit tests (380+ tests)
npm run test

# Run test coverage
npm run test:coverage
```

---

## 🗺️ Roadmap & Next Steps

This package completes the **AI Core Engine**. To build the full production SaaS, the next layers to implement are:

1. **Persistent Memory:** Implement a Redis or PostgreSQL `IMemoryProvider`.
2. **API Server:** Wrap the orchestrator in an Express/Fastify API with REST routes for chat, ingestion, and management.
3. **Database Layer:** Add PostgreSQL (via Prisma/Drizzle) for multi-tenant data, users, and API keys.
4. **Authentication:** Implement JWTs, API Key middleware, and RBAC.
5. **Dashboard & Widget:** Build the frontend management UI and the embeddable chat widget.

<p align="center">
  <h1 align="center">🚀 Ion AI — Multi-Tenant AI Chatbot Platform</h1>
  <p align="center">
    A production-grade, provider-agnostic SaaS platform for deploying AI chatbots with RAG (Retrieval-Augmented Generation), multi-tenant knowledge bases, and embeddable chat widgets.
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-20+-green?logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/pnpm-9.5-orange?logo=pnpm" alt="pnpm" />
  <img src="https://img.shields.io/badge/Turborepo-2.0-blueviolet?logo=turborepo" alt="Turborepo" />
  <img src="https://img.shields.io/badge/License-Proprietary-red" alt="License" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Quick Start (Development)](#quick-start-development)
- [Environment Configuration](#environment-configuration)
- [Docker Deployment](#docker-deployment)
- [Production Deployment (AWS)](#production-deployment-aws)
- [API Reference](#api-reference)
- [Widget SDK](#widget-sdk)
- [Testing & CI/CD](#testing--cicd)
- [Security](#security)
- [Contributing](#contributing)

---

## Overview

Ion AI is a full-stack platform that enables organizations to:

1. **Upload knowledge** — PDFs, DOCX, TXT, Markdown, and website crawling
2. **Process & embed** — Automatic chunking, embedding (OpenAI, Gemini, Cohere, Ollama), and vector storage (Qdrant)
3. **Deploy chatbots** — Embeddable widget SDK with real-time streaming responses
4. **Manage everything** — Multi-tenant dashboard with RBAC, audit logging, and AI cost guardrails

### Key Capabilities

| Feature                    | Details                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Multi-Tenant Isolation** | Complete data separation per organization with role-based access (Owner, Admin, Editor, Viewer)                       |
| **Provider-Agnostic AI**   | Swap LLM providers (OpenAI, Gemini, Anthropic, Groq, OpenRouter, Ollama) and embedding providers with a config change |
| **RAG Pipeline**           | Document ingestion → chunking → embedding → vector search → context-aware chat                                        |
| **Website Crawler**        | Production-grade crawler with SSRF protection, robots.txt compliance, and DNS-rebinding prevention                    |
| **Embeddable Widget**      | Drop-in JavaScript SDK with Shadow DOM isolation, SSE streaming, and markdown rendering                               |
| **Cost Guardrails**        | Per-org daily quotas, RPM rate limiting, output token caps for free-tier protection                                   |
| **Real-time Streaming**    | Server-Sent Events for chat responses, job progress, and crawler status                                               |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│  ┌─────────────────────┐    ┌──────────────────────────┐                    │
│  │  Dashboard (Next.js) │    │  Widget SDK (Embeddable)  │                    │
│  │  :3000               │    │  Shadow DOM + SSE          │                    │
│  └─────────┬───────────┘    └────────────┬─────────────┘                    │
│            │                              │                                  │
│            └──────────────┬───────────────┘                                  │
│                           ▼                                                  │
│              ┌────────────────────────┐                                      │
│              │  Nginx Reverse Proxy   │                                      │
│              │  (TLS, Security Hdrs)  │                                      │
│              └───────────┬────────────┘                                      │
│                          ▼                                                   │
│              ┌────────────────────────┐       ┌───────────────────────┐      │
│              │  API Server (Fastify)  │──────▶│  BullMQ Job Queue     │      │
│              │  :3001                 │       │  (Redis)              │      │
│              │  • Auth (JWT)          │       └───────────┬───────────┘      │
│              │  • RBAC                │                   │                  │
│              │  • Rate Limiting       │                   ▼                  │
│              │  • Zod Validation      │       ┌───────────────────────┐      │
│              └───────────┬────────────┘       │  Worker Service       │      │
│                          │                    │  • Ingestion Pipeline  │      │
│           ┌──────────────┼──────────────┐     │  • Crawler Pipeline   │      │
│           ▼              ▼              ▼     └───────────┬───────────┘      │
│  ┌────────────┐  ┌──────────────┐  ┌────────┐            │                  │
│  │ PostgreSQL │  │   Qdrant     │  │  R2/S3 │            │                  │
│  │ (Prisma)   │  │ Vector DB   │  │Storage │◀───────────┘                  │
│  └────────────┘  └──────────────┘  └────────┘                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
Client → Nginx → API (Fastify) → Controllers → Services → Repositories → Database (Prisma)
                                      ↓
                              AI Core Engine
                    (LLM → Embedder → Vector Store → Retriever → Prompt Builder → Orchestrator)
```

---

## Tech Stack

| Layer                | Technology                                                        |
| -------------------- | ----------------------------------------------------------------- |
| **Monorepo**         | Turborepo + pnpm workspaces                                       |
| **Language**         | TypeScript 5.5 (strict mode, ES2022)                              |
| **API Server**       | Fastify 4 with JWT auth, rate limiting, multipart uploads         |
| **Dashboard**        | Next.js 14 (App Router, standalone output) with Tailwind CSS      |
| **Worker**           | BullMQ on Redis for async job processing                          |
| **Database**         | PostgreSQL 16 via Prisma ORM                                      |
| **Vector DB**        | Qdrant (HNSW vector index)                                        |
| **Object Storage**   | Cloudflare R2 / AWS S3                                            |
| **AI Providers**     | OpenAI, Google Gemini, Anthropic Claude, Groq, OpenRouter, Ollama |
| **Embedding**        | OpenAI, Gemini, Cohere, Ollama                                    |
| **Crawler**          | Custom engine with Playwright, SSRF guard, robots.txt parsing     |
| **Logging**          | Pino (structured JSON in production, pretty-print in dev)         |
| **Containerization** | Docker (multi-stage builds, non-root users)                       |
| **Reverse Proxy**    | Nginx with security headers, SSE support, gzip                    |
| **CI/CD**            | GitHub Actions (lint, typecheck, test, Docker build, Trivy scan)  |

---

## Monorepo Structure

```
ion-ai/
├── apps/
│   ├── api/                    # Fastify REST API server
│   │   ├── src/
│   │   │   ├── controllers/    # Route handlers (12 controllers)
│   │   │   ├── services/       # Business logic layer
│   │   │   ├── repositories/   # Data access layer (Prisma)
│   │   │   ├── plugins/        # Fastify plugins (auth, org-context)
│   │   │   ├── di.ts           # Dependency injection container
│   │   │   └── index.ts        # Server entrypoint
│   │   └── Dockerfile
│   │
│   ├── dashboard/              # Next.js 14 management UI
│   │   ├── app/
│   │   │   ├── (dashboard)/    # Protected dashboard routes
│   │   │   │   ├── knowledge/  # Knowledge base management
│   │   │   │   ├── crawlers/   # Website crawler management
│   │   │   │   ├── playground/ # AI chat playground
│   │   │   │   ├── widgets/    # Widget deployment config
│   │   │   │   ├── members/    # Team & RBAC management
│   │   │   │   ├── settings/   # AI model configuration
│   │   │   │   └── ...
│   │   │   ├── login/          # Authentication pages
│   │   │   └── register/       # Registration with org setup
│   │   ├── middleware.ts        # Route protection middleware
│   │   └── Dockerfile
│   │
│   └── worker/                  # Background job processor
│       ├── src/
│       │   ├── pipeline/        # Ingestion & crawler pipelines
│       │   └── lib/             # Shared utilities
│       └── Dockerfile
│
├── packages/
│   ├── ai-core/                # 🧠 AI engine (LLM, embedding, RAG, vector store)
│   │   └── src/
│   │       ├── llm/            # Multi-provider LLM layer
│   │       ├── embedding/      # Multi-provider embedding layer
│   │       ├── vector-store/   # Qdrant vector store
│   │       ├── knowledge/      # Document chunking & processing
│   │       ├── retriever/      # RAG retrieval engine
│   │       ├── prompt/         # Prompt builder with guardrails
│   │       ├── memory/         # Conversation memory
│   │       └── orchestrator/   # Top-level AI façade
│   │
│   ├── auth/                   # Password hashing & RBAC utilities
│   ├── chat/                   # Chat service, conversation, widget, rate limiting
│   ├── config/                 # Zod-validated environment configuration
│   ├── contracts/              # Shared DTOs, Zod schemas, error types
│   ├── crawler/                # Website crawler with SSRF protection
│   ├── database/               # Prisma schema, migrations, seed
│   ├── logger/                 # Pino structured logging
│   ├── parser/                 # Document parser (PDF, DOCX, TXT, Markdown)
│   ├── queue/                  # BullMQ queue provider
│   ├── storage/                # R2/S3 storage provider
│   └── widget-sdk/             # Embeddable chat widget (Vite build)
│
├── infrastructure/
│   └── nginx/                  # Reverse proxy configuration
│
├── scripts/
│   └── rotate-encryption-key.ts # API key rotation utility
│
├── .github/workflows/
│   ├── ci.yml                  # Quality gate (lint, test, typecheck, Docker, Trivy)
│   └── cd.yml                  # Deployment pipeline (staging/production)
│
├── docker-compose.yml           # Development (PostgreSQL, Redis, Qdrant)
├── docker-compose.prod.yml      # Production (full stack with Nginx)
├── ecosystem.config.js          # PM2 process manager config
└── turbo.json                   # Turborepo task configuration
```

---

## Quick Start (Development)

### Prerequisites

- **Node.js** ≥ 20.x
- **pnpm** ≥ 9.0 (`npm install -g pnpm`)
- **Docker** & Docker Compose (for PostgreSQL, Redis, Qdrant)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/ion-ai.git
cd ion-ai

# 2. Start infrastructure services
docker-compose up -d

# 3. Install dependencies
pnpm install

# 4. Configure environment
cp .env.example .env
# Edit .env with your API keys and secrets

# 5. Generate Prisma client & run migrations
pnpm db:generate
pnpm db:push          # Development: sync schema directly
# OR for production-style:
# pnpm db:migrate:prod  # Run pending migrations

# 6. (Optional) Seed the database with a test user
pnpm db:seed

# 7. Start all services in development mode
pnpm dev
```

This starts:

- **Dashboard** → http://localhost:3000
- **API** → http://localhost:3001
- **Worker** → Background job processor

### Verify Installation

```bash
# Health check
curl http://localhost:3001/health
# → {"status":"ok"}

# Readiness check (verifies database connectivity)
curl http://localhost:3001/ready
# → {"status":"ready","database":"connected"}
```

---

## Environment Configuration

All environment variables are validated at startup using Zod schemas in [`packages/config/index.ts`](packages/config/index.ts). Invalid or missing required values will cause the application to exit with a descriptive error.

See [`.env.example`](.env.example) for the complete reference with descriptions.

### Required Variables

| Variable         | Description                                           |
| ---------------- | ----------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string                          |
| `JWT_SECRET`     | JWT signing secret (min 32 chars)                     |
| `ENCRYPTION_KEY` | AES-256-GCM key for API key encryption (64 hex chars) |

### Optional but Recommended

| Variable              | Description                                        | Default                 |
| --------------------- | -------------------------------------------------- | ----------------------- |
| `GEMINI_API_KEY`      | Google Gemini API key (default free-tier provider) | —                       |
| `R2_ACCOUNT_ID`       | Cloudflare R2 account for document storage         | —                       |
| `QDRANT_URL`          | Qdrant vector database URL                         | `http://localhost:6333` |
| `NEXT_PUBLIC_API_URL` | API URL for the dashboard (set at build time)      | `http://localhost:3001` |

---

## Docker Deployment

### Development

```bash
# Start only infrastructure (PostgreSQL, Redis, Qdrant)
docker-compose up -d
```

### Production (Single Server / Staging)

The [`docker-compose.prod.yml`](docker-compose.prod.yml) includes all services with production hardening:

```bash
# Build and start the full stack
docker-compose -f docker-compose.prod.yml up -d --build
```

**Production Hardening Features:**

- ✅ Pinned image versions (PostgreSQL 16.4, Redis 7.4.1, Qdrant 1.12.1)
- ✅ Network isolation — databases on internal bridge, only Nginx exposed
- ✅ CPU/memory resource limits on all containers
- ✅ Log rotation (50MB × 5 files per service)
- ✅ Multi-stage Docker builds with non-root users
- ✅ Health checks on API and Dashboard containers
- ✅ Security headers via Nginx (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)

---

## Production Deployment (AWS)

### Recommended Architecture

```
AWS Route 53 (DNS) → CloudFront (CDN + WAF) → ALB (HTTPS/ACM)
                                                    │
                          ┌─────────────────────────┼────────────────────────┐
                          ▼                         ▼                        ▼
                   Dashboard (ECS)           API (ECS)               Worker (ECS)
                   [2-10 tasks]              [2-20 tasks]            [1-8 tasks]
                          │                         │                        │
                          └─────────────────────────┼────────────────────────┘
                                                    │
                    ┌──────────────┬────────────────┼─────────────────┐
                    ▼              ▼                ▼                 ▼
              RDS Aurora     ElastiCache       Qdrant Cloud       R2/S3
              PostgreSQL     Redis 7.4         Vector DB          Storage
```

### Key Differences from Docker Compose

| Component        | Single-Node       | AWS Production                           |
| ---------------- | ----------------- | ---------------------------------------- |
| **Availability** | Single VM (SPOF)  | Multi-AZ across 3 zones                  |
| **PostgreSQL**   | Container         | RDS Aurora (Multi-AZ, automated backups) |
| **Redis**        | Container         | ElastiCache (Multi-AZ failover)          |
| **TLS**          | Nginx self-signed | ACM managed certificates                 |
| **Secrets**      | `.env` file       | AWS Secrets Manager                      |
| **Scaling**      | Fixed containers  | ECS Fargate auto-scaling                 |

### Deployment Steps

1. **Set up AWS infrastructure** (RDS, ElastiCache, ECR, ECS, ALB, ACM)
2. **Push Docker images** to ECR via the CD pipeline
3. **Configure secrets** in AWS Secrets Manager
4. **Run database migrations** — `pnpm db:migrate:prod`
5. **Deploy ECS services** via the CD pipeline (`cd.yml`)
6. **Configure DNS** in Route 53

---

## API Reference

All endpoints are prefixed with `/api/v1/`.

### Authentication

| Method | Endpoint         | Description                         |
| ------ | ---------------- | ----------------------------------- |
| `POST` | `/auth/register` | Register user + create organization |
| `POST` | `/auth/login`    | Login and receive JWT token         |

### Organizations

| Method | Endpoint                               | Description               |
| ------ | -------------------------------------- | ------------------------- |
| `POST` | `/organizations`                       | Create new organization   |
| `GET`  | `/organizations/:orgId/members`        | List organization members |
| `POST` | `/organizations/:orgId/members/invite` | Invite member by email    |

### Knowledge Base

| Method   | Endpoint             | Description                              |
| -------- | -------------------- | ---------------------------------------- |
| `GET`    | `/knowledge`         | List knowledge sources                   |
| `POST`   | `/knowledge/upload`  | Upload document (PDF, DOCX, TXT, MD)     |
| `DELETE` | `/knowledge/:id`     | Delete knowledge source                  |
| `POST`   | `/knowledge/search`  | Search knowledge base                    |
| `POST`   | `/knowledge/reindex` | Reindex all documents after model change |

### Website Crawler

| Method   | Endpoint               | Description                  |
| -------- | ---------------------- | ---------------------------- |
| `GET`    | `/crawlers`            | List crawl jobs              |
| `POST`   | `/crawlers`            | Create new crawl job         |
| `GET`    | `/crawlers/:id`        | Get crawl job details        |
| `GET`    | `/crawlers/:id/stream` | SSE stream of crawl progress |
| `POST`   | `/crawlers/:id/retry`  | Retry failed crawl           |
| `POST`   | `/crawlers/:id/cancel` | Cancel running crawl         |
| `DELETE` | `/crawlers/:id`        | Delete crawl job             |

### Chat

| Method | Endpoint       | Description                           |
| ------ | -------------- | ------------------------------------- |
| `POST` | `/chat`        | Send message (SSE streaming response) |
| `GET`  | `/chat/config` | Get widget configuration              |

### Configuration

| Method  | Endpoint                  | Description                           |
| ------- | ------------------------- | ------------------------------------- |
| `GET`   | `/configuration`          | Get AI configuration                  |
| `PATCH` | `/configuration`          | Update AI models, prompts, guardrails |
| `POST`  | `/configuration/api-keys` | Save organization API key             |
| `GET`   | `/configuration/models`   | List available models for a provider  |

### Widgets

| Method  | Endpoint   | Description                            |
| ------- | ---------- | -------------------------------------- |
| `GET`   | `/widgets` | Get widget configuration               |
| `PATCH` | `/widgets` | Update widget theme, branding, domains |

### Health

| Method | Endpoint  | Description                       |
| ------ | --------- | --------------------------------- |
| `GET`  | `/health` | Liveness probe                    |
| `GET`  | `/ready`  | Readiness probe (checks database) |

---

## Widget SDK

The embeddable widget (`packages/widget-sdk`) provides a drop-in chat interface for any website.

### Installation

```html
<!-- Add to your website -->
<script src="https://your-cdn.com/ion-widget.js"></script>
<script>
  new IonWidget({
    widgetKey: 'your-widget-public-key',
    apiBaseUrl: 'https://api.your-domain.com/api/v1',
    title: 'Support Assistant',
  });
</script>
```

### Features

- **Shadow DOM isolation** — Styles never leak into or from the host page
- **SSE streaming** — Real-time token-by-token responses
- **Markdown rendering** — Rich formatted responses with sanitized HTML
- **Conversation persistence** — Maintains context across messages
- **Mobile responsive** — Adapts to any screen size

---

## Testing & CI/CD

### Running Tests

```bash
# Run all tests across the monorepo
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Format code
pnpm format
```

### CI Pipeline (`.github/workflows/ci.yml`)

Triggers on pushes to `main`/`develop` and pull requests:

1. **Install dependencies** (pnpm, frozen lockfile)
2. **Generate Prisma client**
3. **Build all workspaces** (Turborepo)
4. **Lint check**
5. **Type check** (TypeScript strict mode)
6. **Run test suite**
7. **Build Docker images** (dry-run)
8. **Trivy vulnerability scan** (CRITICAL/HIGH)

### CD Pipeline (`.github/workflows/cd.yml`)

Triggers on pushes to `main` and version tags (`v*.*.*`):

1. **Build & push** Docker images to GHCR (or ECR)
2. **Deploy** to ECS (staging or production)
3. **Smoke tests** — Health and readiness probes

---

## Security

### Built-in Protections

- **Authentication**: JWT-based with httpOnly cookies
- **Authorization**: Role-based access control (OWNER > ADMIN > EDITOR > VIEWER)
- **Encryption**: AES-256-GCM encryption for stored API keys with key rotation support
- **Rate Limiting**: Per-visitor, per-organization, and global RPM limits
- **Input Validation**: Zod schema validation on all API endpoints
- **SSRF Protection**: DNS-resolution-time validation, private/reserved IP blocking, redirect chain validation
- **CORS**: Origin restricted to configured frontend URL
- **Container Security**: Non-root users, minimal Alpine images, Trivy scanning
- **Network Isolation**: Internal Docker bridge for databases, only Nginx exposed

### Reporting Vulnerabilities

If you discover a security vulnerability, please send an email to **security@ion-ai.com**. All security vulnerabilities will be promptly addressed.

---

## Contributing

1. Create a feature branch from `main`
2. Make your changes with [Conventional Commits](https://www.conventionalcommits.org/) format
3. Ensure all checks pass:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   ```
4. Open a Pull Request targeting `main`

### Code Style

- Prettier for formatting (auto-run via lint-staged on commit)
- Commitlint enforces conventional commit messages
- Husky pre-commit hooks run lint-staged automatically

---

## License

Proprietary — All rights reserved.

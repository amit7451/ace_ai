# Architecture Overview

This project is a Turborepo monorepo.

## Apps

- **Dashboard:** Next.js application for users to manage their organizations and AI chatbots.
- **API:** Fastify backend handling authentication, database operations, and acting as the gateway to the AI engine.

## Packages

- **ai-core:** The pure, framework-agnostic AI engine (LLMs, Vector DB, Knowledge Processing, RAG).
- **database:** Prisma and PostgreSQL schema.
- **contracts:** Shared DTOs and Zod schemas.
- **auth:** Role-based access control utilities.
- **config:** Environment variable validation.
- **logger:** Pino structured logging.

## Request Flow

Client (Dashboard) -> API (Fastify) -> Controllers -> Services -> Repositories -> Database (Prisma)

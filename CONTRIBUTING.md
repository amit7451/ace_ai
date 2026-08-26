# Contributing to Ion AI

Thank you for your interest in contributing to Ion AI! This document provides guidelines and standards for contributing.

## Development Workflow

1. **Fork & clone** the repository
2. **Create a feature branch** from `main`: `git checkout -b feat/your-feature`
3. **Install dependencies**: `pnpm install`
4. **Start infrastructure**: `docker-compose up -d`
5. **Run in development**: `pnpm dev`
6. **Make your changes** with proper tests

## Code Quality Standards

Before submitting a PR, ensure all checks pass:

```bash
pnpm lint        # ESLint checks
pnpm typecheck   # TypeScript strict mode
pnpm test        # Unit test suite
pnpm format      # Prettier formatting
```

## Commit Convention

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new embedding provider
fix: resolve race condition in crawler pipeline
docs: update API reference
chore: upgrade dependencies
refactor: simplify rate limiter logic
test: add unit tests for auth middleware
```

Commit messages are validated by commitlint via Husky pre-commit hooks.

## Pull Request Process

1. Ensure your branch is up-to-date with `main`
2. All CI checks must pass (lint, typecheck, test, Docker build)
3. Include a clear description of the changes and motivation
4. Link any relevant issues
5. Request review from at least one maintainer

## Project Structure

- `apps/` — Deployable applications (API, Dashboard, Worker)
- `packages/` — Shared libraries and modules
- See the [README](./README.md) for the full monorepo structure

## Adding a New Package

1. Create the directory under `packages/`
2. Add a `package.json` with the `@ion-ai/` namespace
3. Add a `tsconfig.json` extending `../../tsconfig.base.json`
4. The package will be auto-discovered by `pnpm-workspace.yaml`

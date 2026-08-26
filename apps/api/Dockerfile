# ===================================================
# Stage 1: Prune Monorepo for @ion-ai/api
# ===================================================
FROM node:20-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo@2.10.4
COPY . .
RUN turbo prune @ion-ai/api --docker

# ===================================================
# Stage 2: Build Application & Dependencies
# ===================================================
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN npm install -g pnpm@9.5.0 turbo@2.10.4

# First copy lockfile and package.json files for layer caching
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Copy pruned source files
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json

# Generate Prisma Client & Build TypeScript
RUN pnpm --filter @ion-ai/database db:generate
RUN pnpm --filter @ion-ai/api... build

# ===================================================
# Stage 3: Minimal Production Runner
# ===================================================
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat wget
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Create unprivileged non-root user
RUN addgroup --system --gid 10001 nodejs && \
    adduser --system --uid 10001 ionuser

# Copy full built workspace including all package node_modules
COPY --from=builder --chown=ionuser:nodejs /app ./

USER ionuser

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

CMD ["node", "apps/api/dist/index.js"]

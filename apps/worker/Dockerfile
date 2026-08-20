# ===================================================
# Stage 1: Prune Monorepo for @ion-ai/worker
# ===================================================
FROM node:20-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo@2.10.4
COPY . .
RUN turbo prune @ion-ai/worker --docker

# ===================================================
# Stage 2: Build Application & Dependencies
# ===================================================
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
RUN npm install -g pnpm@9.5.0 turbo@2.10.4

# Copy lockfile and package.json files for layer caching
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Copy pruned source files
COPY --from=pruner /app/out/full/ .
COPY --from=pruner /app/tsconfig.base.json ./tsconfig.base.json

# Generate Prisma Client & Build TypeScript
RUN pnpm --filter @ion-ai/database db:generate
RUN pnpm --filter @ion-ai/worker... build

# Prune devDependencies
RUN pnpm prune --prod --no-optional

# ===================================================
# Stage 3: Production Runner with Headless Chromium
# ===================================================
FROM node:20-alpine AS runner
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    openssl \
    libc6-compat

WORKDIR /app

ENV NODE_ENV=production
# Configure Playwright to use Alpine's system Chromium binary
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create unprivileged non-root user
RUN addgroup --system --gid 10001 nodejs && \
    adduser --system --uid 10001 workeruser

# Copy production node_modules and built packages
COPY --from=builder --chown=workeruser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=workeruser:nodejs /app/packages ./packages
COPY --from=builder --chown=workeruser:nodejs /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder --chown=workeruser:nodejs /app/apps/worker/package.json ./apps/worker/package.json
COPY --from=builder --chown=workeruser:nodejs /app/package.json ./package.json

USER workeruser

CMD ["node", "apps/worker/dist/index.js"]

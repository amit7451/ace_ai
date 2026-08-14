FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat
RUN npm install -g pnpm turbo
WORKDIR /app

FROM base AS builder
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @ion-ai/database db:generate
RUN pnpm --filter @ion-ai/worker... build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
RUN npm install -g pnpm

ENV NODE_ENV=production

COPY --from=builder /app ./

CMD ["pnpm", "--filter", "@ion-ai/worker", "start"]

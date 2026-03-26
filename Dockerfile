# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Production
FROM base AS production
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 app
RUN adduser --system --uid 1001 app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json drizzle.config.ts ./
COPY src ./src

USER app

CMD ["npx", "tsx", "src/main.ts"]

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FrazierVCRM is a VC relationship management system for Frazier VC with two components:
1. **Headless pipeline** (`src/pipeline/`): contact sync → VIP classification → signal monitoring → daily digest email (runs via cron)
2. **Web dashboard** (`src/app/`): Next.js 14 app for managing contacts, companies, deals, VIPs, and viewing pipeline results

Single-org (no multi-tenancy). See PLAN.md for current status and remaining work.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run run` | Execute pipeline (`tsx src/pipeline/main.ts`) |
| `npm run typecheck` | TypeScript type checking (`tsc --noEmit`) |
| `npm test` | Run Vitest suite once |
| `npm run test:watch` | Watch mode for tests |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations to PostgreSQL |
| `npm run db:push` | Push schema to database (dev shortcut) |
| `npm run db:studio` | Open Drizzle Studio GUI |

Run a single test file: `npx vitest run src/lib/retry.test.ts`

## Architecture

### Pipeline (`src/pipeline/`)
Entry point is `main.ts`. Runs as a headless script (no web server), triggered by system cron.

1. **Sync** (`sync/icloud.ts`, `sync/google.ts`) — CardDAV + Google People API → upsert contacts
2. **Classify** (`classify.ts`) — DeepSeek AI or heuristic fallback → categorize VIPs (portfolio_founder, lp, coinvestor, advisor)
3. **Monitor** (`monitor.ts`) — Proxycurl job change detection + Google/Bing news → filter "exciting" signals
4. **Digest** (`digest.ts`) — DeepSeek draft generation + Resend email → daily digest to partner

### Database (`src/db/`)
- **ORM**: Drizzle with PostgreSQL (`pg` driver)
- **Schema**: 14 tables in `schema.ts` — core tables are `contacts`, `vips`, `newsItems`, `outreachLog`, `runs`
- **Connection**: Factory in `index.ts`

### Shared Libraries (`src/lib/`)
- `config.ts` — Zod-validated environment variables (exits on invalid config)
- `logger.ts` — Pino logger (pretty in dev, JSON in prod, override with `LOG_LEVEL`)
- `retry.ts` — Exponential backoff with jitter, non-retryable HTTP status awareness
- `auth.ts` — NextAuth + Google OAuth (has type errors, needs fix)
- `utils.ts` — Tailwind `cn()` merge utility

### Web Dashboard (`src/app/`, `src/components/`)
Next.js 14 app with NextAuth (Google OAuth), Radix UI, TanStack Query, React Hook Form. Route groups: `(auth)/` for login, `(dashboard)/` for protected pages. API routes under `src/app/api/` provide CRUD for all entities plus pipeline trigger/run history.

## Key Design Patterns

- **Graceful degradation**: DeepSeek unavailable → heuristics/templates; missing API keys → skip that step
- **Upsert with conflict resolution**: All contact syncs use `onConflictDoUpdate` for idempotency
- **Batch processing**: VIP classification in batches of 150
- **Cooldown window**: `COOLDOWN_DAYS` (default 14) prevents re-contacting same person
- **Per-VIP error isolation**: Individual VIP failures logged but don't fail the entire run

## Tech Stack

- TypeScript 5.6 (strict mode), path alias `@` → `./src`
- Drizzle ORM + PostgreSQL
- DeepSeek API (OpenAI-compatible client)
- tsdav + ical.js for iCloud CardDAV
- Resend for email delivery
- Vitest for testing
- Pino for structured logging

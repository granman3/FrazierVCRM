# FrazierVCRM Plan

## Goal
VC relationship management for Frazier VC with two components:
1. **Headless pipeline** (cron): contact sync → VIP classification → signal monitoring → daily digest email
2. **Web dashboard** (Next.js): manage contacts, companies, deals, VIPs, view pipeline results, trigger runs

Single-org (Frazier VC). No multi-tenancy, no invite system, no setup wizard.

## What Was Cut (from original SaaS)

| Feature | Why |
|---|---|
| Multi-tenancy (tenants table, tenantId FKs) | Single org |
| pg-boss job queue + worker process | System cron is sufficient |
| Invite system + roles | Single org |
| Admin console + platform admin bootstrap | Unnecessary complexity |
| Setup wizard | Config via env vars |
| Encrypted secrets (sodium-native) | Env vars are sufficient |

## Architecture

### Pipeline (`src/pipeline/`)
Entry point: `tsx src/pipeline/main.ts` — triggered by system cron daily.

```
1. Load config from env vars
2. Sync contacts (iCloud CardDAV + Google People API)
3. Classify new contacts → auto-approve VIPs above threshold
4. For each active VIP:
   a. Check for job changes (Proxycurl)
   b. Fetch company news (Google RSS + Bing)
   c. Filter for exciting signals
   d. Skip if contacted within cooldown window
   e. Generate outreach draft (DeepSeek)
5. Send daily digest email (Resend)
6. Log run status
```

### Web Dashboard (`src/app/`)
Next.js 14 app with NextAuth (Google OAuth). Route groups:
- `(auth)/` — login page
- `(dashboard)/` — protected pages: dashboard, contacts, companies, deals, VIPs, news, outreach, settings

API routes under `src/app/api/` provide CRUD for all entities plus pipeline trigger/run history.

### Database (`src/db/`)
PostgreSQL + Drizzle ORM. 14 tables covering contacts, companies, deals, VIPs, news, outreach, interactions, tags, pipeline runs, and NextAuth (users, accounts, sessions).

## Completed Phases

### Phase 1: Schema + Config ✅
- Drizzle schema with 14 tables
- Zod-validated config (`src/lib/config.ts`)
- Pino structured logging (`src/lib/logger.ts`)
- Retry with exponential backoff (`src/lib/retry.ts`)

### Phase 2: Contact Sync ✅
- iCloud CardDAV sync (`src/pipeline/sync/icloud.ts`)
- Google People API sync (`src/pipeline/sync/google.ts`)
- Upsert with conflict resolution

### Phase 3: VIP Classification ✅
- DeepSeek AI classifier + heuristic fallback (`src/pipeline/classify.ts`)
- Auto-approve above configurable threshold
- Batch processing (150 contacts at a time)

### Phase 4: Signal Monitoring ✅
- Proxycurl job change detection (`src/pipeline/monitor.ts`)
- Google News RSS + Bing News API
- Categorization + "exciting" signal filter

### Phase 5: Digest + Orchestration ✅
- DeepSeek draft generation with template fallback (`src/pipeline/digest.ts`)
- Resend email delivery
- Pipeline orchestrator (`src/pipeline/main.ts`)
- Run logging

### Phase 6: Web Dashboard (new API routes + pages) ✅
- CRUD API routes for contacts, companies, deals, VIPs, news, outreach, interactions, tags, search
- Pipeline trigger + run history endpoints
- Dashboard pages with route groups
- Sidebar layout

## Remaining Work

### Phase 7: Fix Build + Auth
- [ ] Fix TypeScript errors in `src/lib/auth.ts` (NextAuth + Drizzle adapter type mismatch)
- [ ] Add `NEXTAUTH_SECRET` and `GOOGLE_CLIENT_ID`/`SECRET` to config validation
- [ ] Implement Google OAuth token refresh flow for pipeline contact sync
- [ ] Fix npm audit vulnerabilities (critical: next, high: eslint plugins)

### Phase 8: Database Migrations
- [ ] Generate initial Drizzle migration (`npm run db:generate`)
- [ ] Test migration against fresh PostgreSQL instance
- [ ] Add migration to CI/deployment pipeline

### Phase 9: Dashboard UI Build-Out
- [ ] Wire dashboard pages to API routes (currently placeholder pages)
- [ ] Add data tables, forms, and filters for each entity
- [ ] Pipeline run history view with status indicators
- [ ] Manual pipeline trigger from dashboard
- [ ] Settings page for config management

### Phase 10: Testing + Production
- [ ] Integration tests against real database
- [ ] API route tests
- [ ] Reach 80%+ test coverage
- [ ] Update Dockerfile for combined pipeline + web server
- [ ] Set up cron schedule for pipeline
- [ ] Production deployment config

## Config (env vars)

```env
# Database (required)
DATABASE_URL=postgresql://user:pass@localhost:5432/frazier_vcrm

# Auth (required for dashboard)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=

# Google OAuth (required for dashboard login + optional contact sync)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_ACCESS_TOKEN=
GOOGLE_REFRESH_TOKEN=

# iCloud (optional contact source)
ICLOUD_USERNAME=
ICLOUD_APP_PASSWORD=

# AI + Enrichment (optional, graceful degradation)
DEEPSEEK_API_KEY=
PROXYCURL_API_KEY=
BING_NEWS_API_KEY=

# Email (optional)
RESEND_API_KEY=
RESEND_FROM_EMAIL=digest@yourdomain.com
DIGEST_TO_EMAIL=you@fraziervc.com

# Tuning
VIP_AUTO_APPROVE_THRESHOLD=0.85
COOLDOWN_DAYS=14
```

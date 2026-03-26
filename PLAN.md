# FrazierVCRM Simplification Plan

## Goal
Rewrite the app as a lightweight background pipeline for Frazier VC. Strip the multi-tenant SaaS architecture, web UI, and job queue. Keep only the core value: **contact sync → VIP classification → signal monitoring → daily digest email**.

## What Gets Cut

| Current Feature | Why It's Cut |
|---|---|
| Multi-tenancy (tenants table, all tenantId FKs) | Single org (Frazier VC) |
| NextAuth + Google OAuth | No web UI needed |
| Next.js web app (all pages, components, middleware) | Pipeline runs headless |
| pg-boss job queue + worker process | Simple cron replaces this |
| Invite system + roles | Single org, no users |
| Admin console + platform admin bootstrap | No web UI |
| Setup wizard | Config via env vars |
| Encrypted secrets (sodium-native) | Env vars are sufficient |
| Audit log table | Overkill for single org |
| shadcn/ui + Radix + Tailwind + React Query | No frontend |
| ~60 UI/API files | Replaced by ~8 files |

## What Gets Kept (Simplified)

| Feature | Current | Simplified |
|---|---|---|
| Contact sync | iCloud CardDAV + Google Contacts via encrypted secrets | Same sources, credentials from env vars |
| VIP classification | DeepSeek + heuristic fallback | Keep as-is, great logic |
| Job change detection | Proxycurl LinkedIn enrichment | Keep as-is |
| News monitoring | Google RSS + Bing News | Keep as-is |
| Daily digest email | Resend HTML email | Keep as-is |
| Database | PostgreSQL + Drizzle (14 tables) | PostgreSQL + Drizzle (6 tables) |
| Run tracking | automation_runs table | Keep simplified |

## New Architecture

**Type**: Headless TypeScript pipeline, triggered by system cron
**Runtime**: `tsx` script (or compiled with `tsc`)
**No web server, no job queue, no frontend**

### File Structure (~8 files)
```
src/
├── main.ts              # Entry point — orchestrates the full pipeline
├── db/
│   ├── schema.ts        # 6 tables (contacts, vips, news, outreach, runs)
│   └── index.ts         # Drizzle connection
├── sync/
│   ├── icloud.ts        # iCloud CardDAV sync
│   └── google.ts        # Google Contacts sync
├── classify.ts          # VIP classification (DeepSeek + heuristic)
├── monitor.ts           # Job change detection + news fetching
├── digest.ts            # Email generation + sending via Resend
└── config.ts            # Env var loading + validation
```

### Simplified Schema (6 tables)
```
contacts          — synced contacts (replaces contacts_snapshot + contacts_merged)
vips              — approved VIPs to monitor (replaces vip_list + vip_candidates)
news_items        — cached news articles
outreach_log      — history of sent drafts
runs              — pipeline execution history
```

No `tenantId` on anything. No invites, sessions, accounts, audit_log, or verification_tokens tables.

### Pipeline Flow (main.ts)
```
1. Load config from env vars
2. Sync contacts (iCloud + Google)
3. Classify new contacts → suggest VIPs (auto-approve above threshold)
4. For each active VIP:
   a. Check for job changes (Proxycurl)
   b. Fetch company news (Google RSS + Bing)
   c. Filter for exciting signals
   d. Skip if contacted in last 14 days
   e. Generate outreach draft (DeepSeek)
5. Send daily digest email (Resend)
6. Log run status
```

### Config (env vars only)
```env
DATABASE_URL=
ICLOUD_USERNAME=
ICLOUD_APP_PASSWORD=
GOOGLE_ACCESS_TOKEN=
GOOGLE_REFRESH_TOKEN=
DEEPSEEK_API_KEY=
PROXYCURL_API_KEY=
BING_NEWS_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
DIGEST_TO_EMAIL=           # who receives the daily digest
VIP_AUTO_APPROVE_THRESHOLD=0.85  # auto-approve VIPs above this confidence
```

### Scheduling
System cron runs `tsx src/main.ts` daily at 7 AM (or whatever time Frazier wants). No pg-boss, no worker process.

## Dependencies (Before → After)

**Cut**: next, next-auth, react, react-dom, @radix-ui/*, @tanstack/react-query, react-hook-form, tailwind*, class-variance-authority, clsx, lucide-react, pg-boss, sodium-native, @auth/drizzle-adapter, @react-email/components, tailwindcss-animate, tailwind-merge, concurrently, autoprefixer, postcss, eslint-config-next

**Keep**: drizzle-orm, drizzle-kit, pg, openai, resend, tsdav, zod, tsx, typescript, vitest

**~25 dependencies → ~10 dependencies**

## Implementation Phases

### Phase 1: Schema + Config (foundation)
- Create simplified schema (6 tables)
- Create config.ts with env var validation (Zod)
- Set up Drizzle connection
- Generate and run migration

### Phase 2: Contact Sync
- Port iCloud CardDAV sync (strip tenantId, use env vars directly)
- Port Google Contacts sync (same)
- Write to simplified contacts table

### Phase 3: VIP Classification
- Port DeepSeek classifier + heuristic fallback
- Auto-approve VIPs above confidence threshold
- Write to simplified vips table

### Phase 4: Signal Monitoring
- Port Proxycurl job change detection (env var API key)
- Port Google RSS + Bing news fetching
- Port news categorization + "exciting" filter

### Phase 5: Digest + Orchestration
- Port Resend email digest generation
- Wire up main.ts pipeline orchestrator
- Add run logging
- Test end-to-end

### Phase 6: Cleanup + Deploy
- Remove all old files (Next.js app, components, middleware, etc.)
- Update package.json (strip UI deps)
- Update Dockerfile to simple script runner
- Set up cron schedule
- Update .env.example

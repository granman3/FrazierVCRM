# Solo Chief-of-Staff — Spec-Driven Development Plan

## Locked-in decisions (from our Q&A)


| Area                   | Choice                                            | Implication                                                              |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| **Architecture**       | **Monolith** (Next.js + pg-boss)                  | Single codebase; API routes + background jobs; no external workflow tool |
| **State store**        | **Postgres**                                      | Single DB for app + job queue (pg-boss uses same DB)                     |
| **Frontend**           | **Next.js 14+ / Tailwind / shadcn**               | Server components, responsive out of box, fast iteration                 |
| **Backend**            | **Next.js API routes + Drizzle ORM**              | Same codebase as frontend; type-safe DB queries                          |
| **Background jobs**    | **pg-boss**                                       | Postgres-backed job queue; cron scheduling; retries; same DB as app      |
| **Contact sources**    | **iCloud + Google Contacts + CSV upload**         | Three import methods; background jobs sync each                          |
| **Contact identity**   | Email (primary) + fuzzy name+company match        | Merge duplicates across sources                                          |
| **VIP selection**      | AI classifier → **in-app approval UI**            | Polished dashboard for reviewing/approving VIP suggestions               |
| **VIP count**          | **200+ VIPs** per tenant                          | Designed for high volume; efficient batching required                    |
| **Product surface**    | Web app + credential wizard + trust copy          | Users configure integrations via UI; no DM'ing secrets                   |
| **Backend posture**    | Clean architecture + secrets hygiene              | Ports/adapters pattern; encrypted secrets; OAuth-first                   |
| **Design style**       | **Clean/minimal (Linear-style), light mode only** | Focus on clarity, lots of whitespace                                     |
| **First-time UX**      | Linear setup wizard after login                   | Wizard is primary UX until all integrations connected                    |
| **Setup assistance**   | Guided "Test connection" (green/red)              | Each integration validates itself before proceeding                      |
| **Ongoing visibility** | **Product web app only**                          | Dashboard shows job runs from `automation_runs` table                    |
| **Dashboard v1**       | Integration health + run history + VIP approval   | Polished UI required for VC beta users                                   |
| **Clients**            | Desktop + mobile web equally                      | Responsive layouts, touch-friendly wizard                                |
| **Auth**               | **Google OAuth only** (v1)                        | Also grants Google Contacts access if user chooses that source           |
| **Access control**     | **Invite-only**                                   | Admin generates link, copies, sends manually via Gmail/etc.              |
| **Bootstrap**          | **PLATFORM_ADMIN_EMAIL** env var                  | First matching Google sign-in becomes platform admin                     |
| **Multi-user**         | Multiple users per tenant                         | Roles: `platform_admin`, `admin`, `member`                               |
| **Setup completion**   | **Strict gate**                                   | Wizard blocked until all required integrations pass test                 |
| **Beta audience**      | **VCs / investors** (2-3 clients)                 | Tracking portfolio founders + LPs; need polished UX                      |
| **API keys**           | **Shared** (platform pays for all API costs)      | Tenants don't need their own Proxycurl/DeepSeek keys                     |
| **Billing (v1)**       | **Manual** (invoice / agreement)                  | No Stripe in v1; optional usage flags per tenant                         |
| **Legal (v1)**         | **Privacy Policy + Terms of Service**             | Required before real client data; DPA is phase 2                         |
| **Infrastructure**     | **Docker on Proxmox** (existing Linux VM)         | Self-hosted; Cloudflare for DNS/proxy                                    |
| **Timeline**           | **2 weeks** (aggressive sprint)                   | Full spec; working ~12-14 hour days                                      |


**Confirmed choices:**


| Component        | Choice                            | Notes                                         |
| ---------------- | --------------------------------- | --------------------------------------------- |
| **LLM**          | DeepSeek V3 (`deepseek-chat`)     | User has existing API key                     |
| **Enrichment**   | Proxycurl                         | Real-time LinkedIn scraping, ~$0.01/profile   |
| **News**         | Google RSS + Bing News fallback   | Free tier strategy; maximize free resources   |
| **Email**        | Resend                            | For sending daily digest emails               |
| **Delivery**     | Daily digest email (HTML) at 7 AM | Per-tenant timezone (detect + allow override) |
| **Message tone** | Warm and personal                 | "Hey! Saw the news about..."                  |
| **News links**   | Reference without link            | Draft text doesn't include URL                |
| **No company**   | Try LinkedIn enrichment           | Use Proxycurl to fill in missing company      |
| **No news**      | Keep checking silently            | No "just checking in" prompts                 |
| **Duplicates**   | Merge by name + company           | Fuzzy matching across sources                 |
| **Auth failure** | Email tenant immediately          | Alert them to re-authenticate                 |


**News triggers (all selected):**

- Funding rounds (any size)
- Job changes (promotions, new roles)
- Company milestones (acquisitions, IPO, launches)
- Press/media mentions (articles, podcasts, interviews)

---

## Parts Index


| Part | Title                    | Summary                                               |
| ---- | ------------------------ | ----------------------------------------------------- |
| 1    | State Store              | Database schema: tenants, users, contacts, VIPs, runs |
| 2    | Contact Sources          | iCloud CardDAV + Google Contacts + CSV upload         |
| 3    | VIP Classifier           | DeepSeek suggests VIPs → in-app approval UI           |
| 4    | Main Loop                | Enrich → news → draft → daily digest (7 AM)           |
| 5    | APIs & Cost Controls     | Proxycurl, Google RSS, Bing News, DeepSeek            |
| 6    | Delivery                 | Daily HTML email digest via Resend                    |
| 7    | Web App & Wizard         | Credential onboarding, routing, OAuth flows           |
| 8    | Backend Architecture     | Ports/adapters, secrets encryption, tenant isolation  |
| 9    | Trust & Marketing        | Security page, "why not a person?" copy               |
| 10   | Dashboard                | Integration health, run history, VIP approval         |
| 11   | Invite System            | Generate/copy/accept invite links                     |
| 12   | Platform Admin Bootstrap | `PLATFORM_ADMIN_EMAIL` first-user flow                |
| 13   | Admin Console            | Tenant/platform admin management views                |
| 14   | Multi-user per Tenant    | Roles, permissions, shared resources                  |
| 15   | Legal Pages              | Privacy Policy, Terms of Service                      |
| 16   | Background Jobs          | pg-boss worker; cron scheduling; job handlers         |
| 17   | Tech Stack               | Next.js, Postgres, Drizzle, DeepSeek, etc.            |
| 18   | API Specification        | REST endpoints for all features                       |
| 19   | Error Handling           | Consistent errors, logging, alerting                  |
| 20   | Deployment               | Docker Compose, Caddy, Proxmox                        |
| 21   | Testing Strategy         | Unit, integration, E2E test approach                  |
| 22   | 2-Week Sprint Plan       | Day-by-day implementation schedule                    |


---

## High-level architecture

```mermaid
flowchart LR
  subgraph internet [Internet]
    Browser[Browser]
    CF[Cloudflare]
  end
  subgraph server [Your VPS]
    subgraph app [Next.js App]
      UI[Wizard + Dashboard]
      API[API Routes]
    end
    Worker[Background Worker]
    DB[(Postgres)]
  end
  subgraph sources [Data Sources]
    CardDAV[iCloud CardDAV]
  end
  subgraph external [External APIs]
    Enrich[Apollo/Proxycurl]
    News[NewsAPI/Perigon]
    LLM[OpenAI/Anthropic]
  end
  subgraph delivery [Delivery]
    Slack[Slack]
    Sheets[Google Sheets]
  end
  Browser --> CF
  CF --> UI
  UI --> API
  API --> DB
  Worker --> DB
  Worker --> CardDAV
  Worker --> Enrich
  Worker --> News
  Worker --> LLM
  Worker --> Slack
  Worker --> Sheets
```



**Narrative for stakeholders (e.g. "Javier"):** The product follows **ports-and-adapters (hexagonal) layering**: domain rules (VIP, outreach, hype filter) stay independent of HTTP frameworks and vendor SDKs. Integrations sit behind interfaces; the web app never exposes raw secrets after save. Security posture is aligned with **common patterns in successful SaaS security documentation** (OAuth where possible, scoped tokens, encryption at rest for secrets, no secrets in logs, audit trail for credential changes)—not "trained on DMs," but **deliberately modeled after established public playbooks** (OWASP SaaS guidance, vendor OAuth docs, least-privilege API keys).

---

## Part 1 — State store (database) spec

**Goal:** One source of truth for VIPs, last outreach, and classifier state.

**Multi-tenancy:** All tables below include `tenant_id` (FK to `tenants`) so the web product can isolate workspaces; uniqueness is `(tenant_id, …)` not global.

**Tables (minimal):**

1. **tenants** / **users** / **invites**
  - See Part 11–12 for full schema.
  - `tenants`: workspace container; all domain tables include `tenant_id` FK.
  - `users`: Google OAuth identity + role (`platform_admin` | `admin` | `member`).
  - `invites`: invite tokens with expiration, type, acceptance tracking.
2. **contacts_snapshot**
  - `tenant_id`, `carddav_uid` (composite PK), `full_name`, `company`, `title`, `email`, `phone`, `linkedin_url`, `raw_vcard_snippet`, `last_synced_at`.
  - Purpose: Latest pull from iCloud; used by classifier and by main loop.
3. **vip_candidates**
  - `carddav_uid` (PK), `suggested_at`, `reason` (AI-generated), `approved` (NULL | true | false), `reviewed_at`.
  - Purpose: Output of classifier; you set `approved` via Sheet (or Slack).
4. **vip_list**
  - `carddav_uid` (PK), `added_at`.
  - Purpose: Only contacts with `approved = true` get copied here; main loop reads from this.
5. **outreach_log**
  - `id`, `carddav_uid`, `news_item_id`, `draft_sent_at`, `delivery_method`, `delivery_payload` (e.g. link to Slack message).
  - Purpose: "Last news story sent" per VIP; anti-spam and continuity.
6. **news_items** (optional but useful)
  - `id`, `headline`, `url`, `source`, `published_at`, `fetched_at`, `relevance_summary`.
  - Purpose: Dedupe news; link from `outreach_log`.
7. **integration_secrets** (or use vault + reference IDs only)
  - `tenant_id`, `integration_type`, `encrypted_payload` or `secret_ref`, `created_at`, `rotated_at`, `revoked_at`.
  - Purpose: Persist OAuth tokens and API keys with encryption; never store plaintext in app tables.
8. **automation_runs** (for dashboard "run history")
  - `id`, `tenant_id`, `started_at`, `finished_at`, `status` (success / partial / failed), `vips_considered`, `drafts_created`, `skipped_no_signal`, `error_summary` (safe string, no secrets).
  - Purpose: Populate Part 10 dashboard; each chief-of-staff loop (and optionally classifier runs) writes one row.

**Acceptance criteria (state store):**

- Schema applied on Postgres or SQLite (migration or CREATE script).
- Worker process reads/writes via Drizzle ORM.
- `vip_list` is updated only from `vip_candidates` where `approved = true`.

---

## Part 2 — iCloud Contacts sync spec

**Goal:** Reliably pull all contacts (or a defined subset) from iCloud into `contacts_snapshot`.

**Inputs:**

- iCloud Apple ID + app-specific password (or OAuth if we use a bridge).
- CardDAV base URL (e.g. `https://contacts.icloud.com/...`).

**Process:**

1. Authenticate to CardDAV.
2. List all address book URLs, then all vCards in the default (or chosen) address book.
3. For each vCard: parse and extract `UID`, `FN`, `ORG`, `TITLE`, `EMAIL`, `TEL`, `URL` (and note which URL is LinkedIn if detectable).
4. Upsert into `contacts_snapshot` keyed by `carddav_uid`; set `last_synced_at`.

**Acceptance criteria:**

- Sync runs on schedule (e.g. once daily) or via manual trigger from admin UI.
- New/updated contacts appear in `contacts_snapshot`; deleted contacts can be soft-deleted or removed in a second pass.
- No duplicate rows per `carddav_uid`.

**Implementation:** Use a CardDAV client library (e.g. `tsdav` or `dav` npm packages) directly in the `contacts-sync` job handler. Parse vCards with `ical.js` or similar.

---

## Part 3 — VIP classifier (AI agent) spec

**Goal:** From all contacts in `contacts_snapshot`, produce a list of suggested VIPs with reasons; you approve; approved entries populate `vip_list`.

**Inputs:**

- Full `contacts_snapshot` (or a recent delta).
- Prompt parameters: definition of "important" (default: investors/founders/execs, people to stay top-of-mind with).

**Process:**

1. Batch contacts (e.g. 50 at a time) to stay within token limits.
2. For each batch, call LLM with structured prompt: "Given these contacts (name, company, title, etc.), which are VIPs for relationship upkeep? Return list of UIDs and short reason."
3. Merge results into `vip_candidates`: insert new suggestions, update `suggested_at` and `reason` for existing UIDs; do not overwrite `approved` if already set.
4. (Optional) Sync `vip_candidates` to a Google Sheet: columns UID, Name, Company, Reason, Approved (Y/N).
5. When you set Approved=Y in Sheet, a separate process (or same workflow) copies those rows into `vip_list` and sets `approved = true`, `reviewed_at = now`.

**Anti-spam / quality:**

- If no new "exciting" signal in a run, do not send a notification (per your original rule).
- Classifier runs on a different schedule (e.g. weekly) than the main loop (twice daily).

**Acceptance criteria:**

- Every contact in `contacts_snapshot` is considered by the classifier (batched).
- `vip_candidates` always has a non-null `reason` for each suggested UID.
- Approval in Sheet (or chosen surface) updates `vip_list` and marks `approved` in `vip_candidates`.
- Main loop never reads from `vip_candidates`; it only reads from `vip_list` + `contacts_snapshot`.

---

## Part 4 — Main loop spec (twice-daily "chief of staff")

**Goal:** For each approved VIP, check job changes + exciting news; if found, draft message and notify you for one-click copy/paste (no auto-send).

**Trigger:** pg-boss cron schedule (e.g. 8:00 and 18:00 in tenant's timezone).

**Steps:**

1. **Read VIP list**
  - Query `vip_list` JOIN `contacts_snapshot` to get current `carddav_uid`, name, company, title, LinkedIn, email.
2. **Enrichment (job changes)**
  - For each VIP: call Apollo or Proxycurl (by LinkedIn URL or email); get current job/company.
  - Compare to `contacts_snapshot`; if company/title changed, flag "job change" and store in run state.
3. **News search ("Exciting" only)**
  - For each VIP's company (and optionally person): query NewsAPI or Perigon with filters:
    - Series B+ funding, major pivot, high-profile hire, or negative event (supportive check-in).
  - Exclude items already in `outreach_log` for this VIP.
  - **Hype filter:** If nothing matches the excitement criteria, do not create a draft for this VIP this run (anti-spam).
4. **Draft**
  - For each VIP with at least one trigger (job change or exciting news): call LLM with template: "Contact: X, Company: Y. Event: Z. Draft a short, personal message I can send via iMessage/WhatsApp; tone: warm, not salesy. Max 2–3 sentences."
  - Store draft text + link to news/item.
5. **Notify you (one-click delivery)**
  - **Option A (Slack):** Post to private channel: contact name, news link, draft, and a "Copy" button (Slack's copy is one click).
  - **Option B (Sheet + Shortcut):** Append row to "Pending drafts" Sheet (contact, draft, link); your iPhone Shortcut reads latest and opens iMessage.
  - Do not send the message automatically; delivery = "notify human with draft."
6. **Log**
  - For each draft sent to you, insert into `outreach_log` (carddav_uid, news_item_id, draft_sent_at, delivery_method/payload).
  - Next run will skip that news item for that VIP (no duplicate "same story" drafts).

**Acceptance criteria:**

- Loop runs at most twice per day per schedule.
- No notification when there is no exciting news and no job change (silent run).
- Drafts are delivered to Slack or Sheet within 3 seconds of copy/paste (per your "under 3 seconds" goal).
- Each draft is logged so the same news is not suggested again for the same VIP.

---

## Part 5 — APIs and cost controls

- **Enrichment:** Apollo.io or Proxycurl; use only for VIPs in `vip_list` (low volume); stay on Starter/pay-as-you-go.
- **News:** NewsAPI or Perigon; filter by date (e.g. last 7 days) and by your "hype" keywords (funding, hire, pivot, etc.).
- **LLM:** One provider (e.g. OpenAI, Anthropic, or local); used for classifier (batched) and for drafts (one per VIP per run).
- **Rate limits:** In spec, add "max N enrichment calls per run" and "max M news queries per run" to avoid surprise bills.

---

## Part 6 — Delivery spec (one-click)

- **Slack:** Message must include: [Contact name], [News headline + URL], [Draft text]. Slack's native copy gives one-click.
- **Sheet + Shortcut:** Sheet columns: Contact name, Phone or iMessage handle, Draft, News URL, Timestamp. Shortcut: "Get latest row → open Messages to that contact with draft pre-filled."

**Acceptance criteria:**

- You can go from notification to pasted draft in under 3 seconds.

---

## Part 7 — Web application and credential onboarding spec

**Goal:** A first-run (and settings) experience that collects **all integration credentials** in one place, with clear steps and validation—so users never need to paste secrets into a chat with a human.

**Routing rules (matches your mental model):**

- **New user after login:** Redirect straight into the **linear setup wizard** (progress bar, one step at a time). No "main dashboard" route until wizard marks **complete** (all required integrations connected + at least one successful health check where applicable).
- **Returning user with incomplete setup:** Resume wizard at last incomplete step (saved progress).
- **Setup complete:** Land on **Part 10 dashboard** (integration health + run history).
- **Settings:** Post-setup, user can re-open "Integrations" to rotate keys; same guided **Test connection** pattern.

**Core screens / flows:**

1. **Landing + Trust entry** — Short value prop + link to Security / How credentials work (see Part 9).
2. **Account** — Sign up / sign in (email magic link or OAuth provider); establishes **tenant** (workspace) for multi-user productization.
3. **Setup wizard (stepped)** — One integration per step; progress saved; user can exit and resume; **desktop and mobile web** both first-class (responsive, large tap targets).
  - **iCloud / CardDAV:** Apple ID + app-specific password (with inline help + link to Apple's docs); optional "Test connection" that hits CardDAV read-only.
  - **Enrichment:** Apollo or Proxycurl API key; optional webhook URL if needed.
  - **News:** NewsAPI or Perigon key; region/language defaults.
  - **LLM:** Provider + API key or BYOK (bring your own key) toggle.
  - **Delivery:** Slack OAuth (preferred) or bot token + channel ID; **or** Google OAuth for Sheets (preferred) vs service account JSON if unavoidable.
  - **Schedule:** Timezone + twice-daily windows for main loop.
4. **Post-setup dashboard** — See **Part 10** (not shown during first-time wizard).
5. **Rotate / revoke** — Per-integration "Disconnect" and "Replace key" without deleting the whole account.

**Credential acceptance workflow (UX rules):**

- **OAuth-first:** Where the vendor supports it (Slack, Google), use **OAuth with minimal scopes**; show exact scopes in the UI before consent.
- **API keys:** Collect once; on success, show **masked** value only (`sk-…abcd`). Offer "Replace" to submit a new key; never echo full key back.
- **No copy-to-clipboard of secrets** from our server to support chat—support flows use **re-authenticate** or **rotate key** in product.
- **Explicit consent copy** on submit: "I authorize [Product] to store these credentials encrypted for my workspace and use them only to run the automations I enabled."

**Acceptance criteria:**

- User can complete full setup through the web UI only.
- Each integration has a test/health check before marking step complete.
- Secrets are not returned in API responses after initial save (masked only).
- Audit log records credential **events** (created, rotated, revoked) with timestamp and actor, not secret values.
- First-time users cannot access the main dashboard until setup is complete; wizard is the primary experience after login.

---

## Part 10 — Post-setup dashboard (v1)

**Goal:** After credentials are in, users see **how the product is running** via the dashboard.

**Must-have panels (v1):**

1. **Integration health** — One card per connected service (CardDAV, enrichment, news, LLM, delivery). Each shows: status (green/yellow/red), **last successful check** timestamp, **last error** (sanitized—no tokens). Actions: **Test connection**, **Reconnect** / **Replace key** (same patterns as wizard).
2. **Automation run history** — Table or list from `automation_runs`: time started/finished, status, counts (`vips_considered`, `drafts_created`, `skipped_no_signal`). Link row to optional detail (which VIPs got drafts—phase 1 can be summary only).

**Phase 2 (not v1 unless promoted):** Drafts inbox in-app, VIP pipeline view, usage/billing estimates.

**Acceptance criteria:**

- Dashboard loads on small screens without horizontal scroll for core content.
- All job monitoring happens through the dashboard UI.
- Every row in run history is tenant-scoped and contains no secret material.

---

## Part 8 — Backend architecture spec ("solid + impressive")

**Goal:** A maintainable, explainable backend that supports the web app, tenant isolation, and background job processing—without turning into a ball of scripts.

**Recommended shape (clean / hexagonal):**


| Layer                  | Responsibility                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Domain**             | Entities: `Tenant`, `ContactSnapshot`, `VipCandidate`, `OutreachLog`, `IntegrationConfig` (typed, no secrets in domain objects—only IDs). Rules: hype filter, dedupe rules. |
| **Application**        | Use cases: `RunCardDavSync`, `RunVipClassification`, `RunChiefOfStaffLoop`, `SaveIntegrationCredentials`, `TestSlackConnection`. Orchestrates domain + ports.               |
| **Ports (interfaces)** | `ICardDavClient`, `IEnrichmentClient`, `INewsClient`, `ILLMClient`, `ISecretStore`, `IJobQueue` (pg-boss).                                                                  |
| **Adapters**           | Implementations: HTTP clients for Apollo/Perigon/LLM; CardDAV adapter; Slack OAuth; Postgres repositories; **KMS or envelope encryption** for secrets.                      |
| **API**                | REST or tRPC/GraphQL for the web app: auth, wizard steps, health; **no secrets in responses**.                                                                              |


**Secrets handling (minimum bar for "people trust the website"):**

- Store integration secrets **encrypted** (envelope encryption with a KMS key or libsodium sealed boxes + key in env/HSM).
- **Tenant isolation:** every query scoped by `tenant_id`; secrets table keyed by `tenant_id` + `integration_type`.
- **Observability:** structured logs with `tenant_id`, `request_id`; **never** log tokens, passwords, or full vCards in clear text.

**Job queue integration:**

- Backend enqueues jobs via pg-boss; worker process executes job handlers
- All business logic lives in `src/jobs/*.ts` and `src/lib/*.ts`
- Same codebase for API routes and background jobs; shared types and utilities

**Acceptance criteria:**

- Architecture diagram in repo README: domain vs adapters vs job handlers.
- Single place to add a new integration (new port + adapter + wizard step).
- Security review checklist: OAuth scopes, encryption, audit log, tenant isolation.

---

## Part 9 — Trust, marketing, and "why not a person?" copy

**Goal:** Reduce anxiety about credentials by being **specific**—users fear "someone on the other end"; a website can still be scary unless you explain **what never happens** (no human sees keys, no resale, no training on your messages unless disclosed).

**Recommended on-site content:**

1. **Security overview** — Encryption at rest, OAuth where possible, minimal retention, where data lives (region), subprocessors list (LLM provider, hosting).
2. **"We don't want your passwords in chat"** — Position the product as **the wrong place** to paste secrets into DMs; the **only** right place is the encrypted settings UI + OAuth screens.
3. **No surprises** — "We will not post to Slack/send email on your behalf until you connect delivery and enable notifications."
4. **Optional advanced** — BYOK for LLM keys; "your keys, your bill."

**Acceptance criteria:**

- Public `/security` or `/trust` page with the above sections (can be concise).
- In-app modals for OAuth and API key entry include 1–2 sentence **why we need this** and **what we won't do**.

---

## Part 11 — Invite system spec (link generation, no email infra)

**Goal:** Platform is invite-only; admins generate shareable links and send them manually (Gmail, iMessage, etc.). No email-sending infrastructure needed.

**Flow:**

1. **Admin opens "Invite" in admin console or settings.**
2. **Generates invite link** — Backend creates a signed, expiring token; returns URL like `https://app.example.com/invite/abc123xyz`.
3. **Admin copies link** — One-click copy button; optionally shows a preview message they can paste alongside ("Hey, I'm inviting you to try…").
4. **Admin sends manually** — Via their own Gmail, Slack DM, iMessage, whatever. Product never sends email.
5. **Recipient clicks link** — Lands on invite acceptance page; sees who invited them, what they're joining.
6. **Google OAuth** — Recipient signs in with Google; on success, they're added to the tenant (or a new tenant is created, depending on invite type).

**Invite types:**


| Type                | Use case                                  | Result on accept                                                              |
| ------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| **Tenant invite**   | Add user to existing tenant               | New `user` row linked to existing `tenant_id`; inherits tenant's integrations |
| **Platform invite** | Invite someone to create their own tenant | New `tenant` + new `user` as tenant admin                                     |


**Database additions (add to Part 1):**

```sql
-- invites table
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) UNIQUE NOT NULL,          -- URL-safe random string
  type VARCHAR(20) NOT NULL,                   -- 'tenant' or 'platform'
  tenant_id UUID REFERENCES tenants(id),       -- NULL for platform invites
  created_by UUID REFERENCES users(id) NOT NULL,
  email_hint VARCHAR(255),                     -- optional: intended recipient (display only, not enforced)
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  accepted_by UUID REFERENCES users(id),
  revoked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- users table (new)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  google_id VARCHAR(255) UNIQUE NOT NULL,      -- from Google OAuth sub claim
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  picture_url TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'member',  -- 'admin' | 'member'
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);

-- tenants table (new, referenced by existing tables)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  setup_completed_at TIMESTAMP,                -- NULL until wizard done
  status VARCHAR(20) DEFAULT 'active'          -- 'active' | 'suspended' | 'churned'
);
```

**Link structure:**

- Token: 32-byte random, base64url encoded (43 chars)
- Expiration: 7 days default (configurable)
- Single-use: Once accepted, cannot be reused
- Revocable: Admin can revoke before acceptance

**UI (admin side):**

1. **Generate button** → Shows modal with:
  - Invite type selector (if platform admin: tenant vs platform; if tenant admin: tenant only)
  - Optional "Email hint" field (just for your reference, not enforced)
  - Expiration dropdown (1 day / 7 days / 30 days)
2. **On generate** → Display link with:
  - **Copy link** button (one-click)
  - Optional pre-written message: "Hey! Here's your invite to [Product]: [link]"
  - **Copy message** button (copies link + message together)
3. **Pending invites list** → Shows all active invites with: email hint, created date, expires date, status, **Revoke** button

**UI (recipient side):**

1. **Invite landing page** (`/invite/:token`) →
  - If valid: Shows "You've been invited by [Name] to join [Product/Tenant]" + **Sign in with Google** button
  - If expired: "This invite has expired. Ask [inviter] for a new link."
  - If already accepted: "This invite was already used." + link to sign in
  - If revoked: "This invite is no longer valid."
2. **After Google OAuth** → Redirect to wizard (new user) or dashboard (existing user added to tenant)

**Security:**

- Tokens are cryptographically random (not guessable)
- Tokens are hashed in DB (store `SHA256(token)`, compare on lookup)
- Rate limit invite generation (e.g., 10/hour per admin)
- Rate limit invite acceptance attempts (e.g., 5/minute per IP)

**Acceptance criteria:**

- Admin can generate invite link with one click
- Link is copy-able; no email sent by system
- Invite expires after configured duration
- Invite can be revoked before acceptance
- Recipient must sign in with Google to accept
- Accepted invite cannot be reused
- Tenant invites add user to existing tenant; platform invites create new tenant

---

## Part 12 — Platform admin bootstrap spec

**Goal:** On first deploy, there's no admin to create invites. The `PLATFORM_ADMIN_EMAIL` environment variable bootstraps the first platform admin.

**Mechanism:**

1. **Environment variable:** `PLATFORM_ADMIN_EMAIL=you@example.com`
2. **On Google OAuth sign-in:**
  - If `users` table is empty AND the Google email matches `PLATFORM_ADMIN_EMAIL`:
    - Create a new `tenant` (name: "Platform Admin" or from Google profile)
    - Create a new `user` with `role = 'platform_admin'`
    - Mark this as the bootstrap tenant
  - If `users` table is NOT empty AND email matches `PLATFORM_ADMIN_EMAIL` AND no platform admin exists:
    - Elevate that user to `platform_admin` (migration path)
3. **Platform admin role:** Can do everything a tenant admin can, PLUS:
  - Generate **platform invites** (invites that create new tenants)
  - View all tenants in admin console
  - Suspend/unsuspend tenants
  - View platform-wide usage stats

**Role hierarchy:**


| Role             | Scope  | Capabilities                                                                        |
| ---------------- | ------ | ----------------------------------------------------------------------------------- |
| `platform_admin` | Global | All tenant admin powers + manage all tenants + platform invites                     |
| `admin`          | Tenant | Manage integrations, generate tenant invites, view all runs, manage users in tenant |
| `member`         | Tenant | View dashboard, view runs (phase 2: more granular permissions)                      |


**Database addition:**

```sql
-- Add to users table
role VARCHAR(20) NOT NULL DEFAULT 'member'  -- 'platform_admin' | 'admin' | 'member'
```

**Acceptance criteria:**

- First user with matching `PLATFORM_ADMIN_EMAIL` becomes platform admin automatically
- Platform admin can generate platform-level invites
- Platform admin can see all tenants
- Removing `PLATFORM_ADMIN_EMAIL` env var does not demote existing platform admin
- If bootstrap email doesn't match, sign-in shows "Invite required" message

---

## Part 13 — Admin console spec

**Goal:** Platform admin and tenant admins have a management view for their scope.

**Platform admin console (platform_admin only):**


| Panel                | Content                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------- |
| **Tenants list**     | All tenants: name, created date, status, user count, setup status, last automation run   |
| **Tenant detail**    | Click into tenant: see their integration health (read-only), run history, users          |
| **Tenant actions**   | Suspend (disables all automations), Unsuspend, Delete (with confirmation + data warning) |
| **Platform invites** | Generate, list, revoke platform-level invites                                            |
| **Platform stats**   | Total tenants, total users, total automation runs (last 30 days), error rate             |


**Tenant admin console (admin role within tenant):**


| Panel                    | Content                                                                           |
| ------------------------ | --------------------------------------------------------------------------------- |
| **Users**                | List users in tenant: name, email, role, last login. Actions: Change role, Remove |
| **Invites**              | Generate tenant invites, list pending, revoke                                     |
| **Integrations**         | Same as settings—reconnect, rotate keys (already in Part 7)                       |
| **Billing** (v1: manual) | Current plan, usage notes, "Contact for billing" link                             |


**Navigation:**

- Platform admin: Top-level nav includes "Admin Console" linking to platform view
- Tenant admin: Settings includes "Team" section for users/invites
- Members: No admin console access; settings only shows their profile

**Acceptance criteria:**

- Platform admin can list and manage all tenants
- Tenant admin can manage users and invites within their tenant only
- Members cannot access admin panels
- Suspend stops all automation runs for that tenant
- All admin actions are audit-logged

---

## Part 14 — Multi-user per tenant spec

**Goal:** Multiple users can belong to one tenant, sharing integrations and automation results.

**Shared resources (tenant-level):**

- Integrations (CardDAV, enrichment, news, LLM, delivery)
- Contacts snapshot
- VIP list and candidates
- Automation runs and outreach log
- Settings (schedule, timezone)

**Per-user resources:**

- Profile (name, email, picture from Google)
- Role within tenant
- Session/auth tokens

**Permissions matrix (v1):**


| Action                    | Member | Admin | Platform Admin |
| ------------------------- | ------ | ----- | -------------- |
| View dashboard            | ✓      | ✓     | ✓ (any tenant) |
| View run history          | ✓      | ✓     | ✓              |
| Manage integrations       | ✗      | ✓     | ✓              |
| Invite users to tenant    | ✗      | ✓     | ✓              |
| Remove users from tenant  | ✗      | ✓     | ✓              |
| Change user roles         | ✗      | ✓     | ✓              |
| Generate platform invites | ✗      | ✗     | ✓              |
| Manage other tenants      | ✗      | ✗     | ✓              |


**First user in tenant:**

- If created via platform invite: becomes `admin` of new tenant
- If added via tenant invite: inherits role specified in invite (default: `member`)

**Leaving/removing:**

- Users can leave a tenant (unless they're the last admin)
- Admins can remove members
- Platform admin can remove anyone
- Last admin cannot leave without transferring admin role

**Acceptance criteria:**

- Multiple users can sign in to the same tenant
- All users see the same dashboard and run history
- Only admins can modify integrations
- Tenant is not orphaned (always has at least one admin)
- User removal is immediate; sessions invalidated

---

## Part 15 — Legal pages spec (Privacy Policy + Terms of Service)

**Goal:** Minimum legal coverage before handling real client data. Not full legal review—templates to customize with lawyer later.

**Privacy Policy (`/privacy`) must cover:**

1. **What we collect:**
  - Account info (email, name from Google OAuth)
  - Integration credentials (encrypted, used only for stated purpose)
  - Contact data synced from your iCloud (stored for automation only)
  - Automation logs (what ran, when, counts—no message content stored unless drafted)
2. **How we use it:**
  - To run the automations you configure
  - To display dashboard and history
  - NOT sold to third parties
  - NOT used to train AI models (unless explicitly opted in)
3. **Third-party services:**
  - List subprocessors: hosting provider, LLM provider, enrichment API, news API
  - Link to their privacy policies
4. **Data retention:**
  - Contact snapshots: refreshed on sync, deleted on account deletion
  - Logs: retained for [X days], then purged
  - Credentials: deleted immediately on disconnect or account deletion
5. **Your rights:**
  - Export your data
  - Delete your account and all associated data
  - Revoke integrations at any time
6. **Security:**
  - Encryption at rest for credentials
  - HTTPS only
  - No human access to your credentials except for debugging with your permission

**Terms of Service (`/terms`) must cover:**

1. **Service description:** What the product does (automation assistant, not financial/legal advice)
2. **Acceptable use:** Don't use for spam, illegal purposes, or to harass contacts
3. **Account responsibility:** You're responsible for your credentials and who you invite
4. **No warranty:** Service provided as-is; no guarantee of uptime or accuracy
5. **Limitation of liability:** Standard limitation clause
6. **Termination:** We can suspend/terminate for abuse; you can cancel anytime
7. **Changes:** We'll notify of material changes; continued use = acceptance

**Display requirements:**

- Links in footer on all pages
- Checkbox on sign-up: "I agree to the [Terms] and [Privacy Policy]"
- Record consent timestamp in `users` table

**Database addition:**

```sql
-- Add to users table
tos_accepted_at TIMESTAMP,
privacy_accepted_at TIMESTAMP
```

**Acceptance criteria:**

- Privacy Policy and Terms pages exist and are publicly accessible
- Sign-up requires explicit consent checkbox
- Consent timestamp recorded per user
- Pages are plain HTML/Markdown (easy to update)
- Footer links visible on all authenticated and public pages

---

## Implementation order (step-by-step)

### Phase 0: Infrastructure (Part 20)

1. **Local dev environment** — Docker Compose with Postgres; `pnpm create next-app`; Drizzle setup
2. **Production VPS** — Provision server; install Docker; configure Caddy + Cloudflare
3. **CI/CD pipeline** — GitHub Actions: lint, test, build, deploy on push to main

### Phase 1: Core Web App (Parts 11–15, 17–19)

1. **Database schema** — All tables from Parts 1, 11–15 + pg-boss tables; run migrations
2. **Auth + bootstrap** — NextAuth with Google OAuth; `PLATFORM_ADMIN_EMAIL` bootstrap (Part 12)
3. **Invite system** — Generate/copy/accept invite links (Part 11)
4. **Legal pages** — Privacy Policy + Terms of Service; consent checkbox (Part 15)
5. **Web app shell** — Routing, layouts, Trust page (Part 9); empty wizard shell

### Phase 2: Integration Wizard (Parts 7, 16)

1. **Secrets encryption** — libsodium envelope encryption for `integration_secrets`
2. **Credential wizard** — OAuth flows (Slack, Google Sheets); API key inputs with masking
3. **pg-boss setup** — Worker process; job handlers skeleton
4. **Test connection flow** — Trigger health-check job; wait for result; green/red status
5. **Wizard gate** — Block dashboard until all required integrations pass

### Phase 3: Multi-user & Admin (Parts 13–14)

1. **Multi-user per tenant** — Add users via invite; role-based access
2. **Tenant admin console** — Manage users, invites, integrations
3. **Platform admin console** — View/manage all tenants (platform_admin only)

### Phase 4: Dashboard (Part 10)

1. **Integration health panel** — Status cards for each connected service
2. **Run history panel** — Table from `automation_runs`; pagination; detail view
3. **Responsive polish** — Mobile-friendly dashboard; touch targets

### Phase 5: Background Jobs (Parts 2–4, 6, 16)

1. **CardDAV client** — `src/lib/carddav.ts`; vCard parsing; sync logic
2. **contacts-sync job** — CardDAV → `contacts_snapshot`; scheduled daily
3. **vip-classifier job** — Batch LLM → `vip_candidates`; scheduled weekly
4. **Enrichment client** — Apollo/Proxycurl API wrapper
5. **News client** — NewsAPI/Perigon API wrapper
6. **LLM client** — OpenAI/Anthropic draft generation
7. **chief-of-staff job** — Enrich + news + draft + notify; 2x daily
8. **Cron scheduler** — Register all tenant jobs with pg-boss

### Phase 6: Delivery & Polish (Parts 5–6)

1. **Slack delivery** — Post drafts to private channel with copy button
2. **Google Sheets delivery** — Append to "Pending drafts" sheet (alternative)
3. **Hype filter** — Silent runs when no signal; dedupe news per VIP
4. **Anti-spam** — Rate limits; "last news sent" tracking in `outreach_log`

### Phase 7: Beta Launch

1. **Self-test** — Run full flow with your own iCloud contacts
2. **Invite 2-3 beta clients** — Generate platform invites; manual onboarding
3. **Monitor & iterate** — Watch Sentry; review logs; fix issues

**Estimated milestone checkpoints:**

- After Phase 1: You can sign in, generate invites, and see empty dashboard
- After Phase 2: Clients can complete setup wizard; health checks work
- After Phase 4: Dashboard shows mock/seeded run data
- After Phase 5: Automations actually run; drafts appear in Slack/Sheets
- After Phase 6: System is production-ready for beta

---

## Part 16 — Background Jobs Architecture (pg-boss)

**Goal:** All automation runs as background jobs in the same codebase. No external workflow tool. Jobs are scheduled via cron patterns, executed by a worker process, with built-in retry and observability.

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Your Server                                  │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      Next.js App                              │   │
│  │                                                               │   │
│  │  ┌─────────────────┐          ┌─────────────────────────┐    │   │
│  │  │   API Routes    │          │     Worker Process      │    │   │
│  │  │                 │          │                         │    │   │
│  │  │  /api/auth      │          │  pg-boss consumer       │    │   │
│  │  │  /api/wizard    │          │  ├─ contacts-sync       │    │   │
│  │  │  /api/dashboard │          │  ├─ vip-classifier      │    │   │
│  │  │  /api/jobs      │ ──────── │  ├─ chief-of-staff      │    │   │
│  │  │                 │  enqueue │  └─ health-check        │    │   │
│  │  └────────┬────────┘          └───────────┬─────────────┘    │   │
│  │           │                               │                   │   │
│  │           │         ┌─────────────┐       │                   │   │
│  │           └────────►│  Postgres   │◄──────┘                   │   │
│  │                     │             │                           │   │
│  │                     │ - app data  │                           │   │
│  │                     │ - pgboss.*  │ (job queue tables)        │   │
│  │                     └─────────────┘                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**Why pg-boss:**


| Feature         | pg-boss                 | Alternative (BullMQ)       |
| --------------- | ----------------------- | -------------------------- |
| Queue backend   | Postgres (same DB)      | Redis (extra service)      |
| Cron scheduling | Built-in                | Requires separate setup    |
| Retries         | Built-in with backoff   | Built-in                   |
| Job history     | In Postgres (queryable) | In Redis (harder to query) |
| Deployment      | Nothing extra           | Need Redis container       |


**Job definitions:**

```typescript
// src/jobs/index.ts
import PgBoss from 'pg-boss';

export const JOB_NAMES = {
  CONTACTS_SYNC: 'contacts-sync',
  VIP_CLASSIFIER: 'vip-classifier',
  CHIEF_OF_STAFF: 'chief-of-staff-loop',
  HEALTH_CHECK: 'integration-health-check',
} as const;

export interface ContactsSyncJob {
  tenantId: string;
}

export interface VipClassifierJob {
  tenantId: string;
}

export interface ChiefOfStaffJob {
  tenantId: string;
}

export interface HealthCheckJob {
  tenantId: string;
  integrationType: 'carddav' | 'enrichment' | 'news' | 'llm' | 'slack' | 'sheets';
}
```

**Worker process:**

```typescript
// src/worker.ts
import PgBoss from 'pg-boss';
import { runContactsSync } from './jobs/contactsSync';
import { runVipClassifier } from './jobs/vipClassifier';
import { runChiefOfStaff } from './jobs/chiefOfStaff';
import { runHealthCheck } from './jobs/healthCheck';

const boss = new PgBoss(process.env.DATABASE_URL!);

async function start() {
  await boss.start();

  // Register job handlers
  await boss.work(JOB_NAMES.CONTACTS_SYNC, runContactsSync);
  await boss.work(JOB_NAMES.VIP_CLASSIFIER, runVipClassifier);
  await boss.work(JOB_NAMES.CHIEF_OF_STAFF, runChiefOfStaff);
  await boss.work(JOB_NAMES.HEALTH_CHECK, runHealthCheck);

  // Schedule cron jobs for all active tenants
  await scheduleAllTenantJobs(boss);

  console.log('Worker started');
}

start().catch(console.error);
```

**Cron scheduling:**

```typescript
// src/jobs/scheduler.ts
export async function scheduleAllTenantJobs(boss: PgBoss) {
  const tenants = await db.query.tenants.findMany({
    where: eq(tenants.status, 'active'),
  });

  for (const tenant of tenants) {
    // Daily contacts sync at 2 AM tenant timezone
    await boss.schedule(JOB_NAMES.CONTACTS_SYNC, '0 2 * * *', {
      tenantId: tenant.id,
    }, { tz: tenant.timezone });

    // Weekly VIP classifier on Sundays at 3 AM
    await boss.schedule(JOB_NAMES.VIP_CLASSIFIER, '0 3 * * 0', {
      tenantId: tenant.id,
    }, { tz: tenant.timezone });

    // Chief of staff loop at 8 AM and 6 PM
    await boss.schedule(JOB_NAMES.CHIEF_OF_STAFF, '0 8,18 * * *', {
      tenantId: tenant.id,
    }, { tz: tenant.timezone });
  }
}
```

**Example job implementation:**

```typescript
// src/jobs/chiefOfStaff.ts
import type { Job } from 'pg-boss';
import { db } from '@/db';
import { automationRuns, vipList, outreachLog } from '@/db/schema';
import { enrichContact } from '@/lib/enrichment';
import { fetchNews } from '@/lib/news';
import { generateDraft } from '@/lib/llm';
import { deliverToSlack } from '@/lib/delivery';

export async function runChiefOfStaff(job: Job<ChiefOfStaffJob>) {
  const { tenantId } = job.data;

  // Create run record
  const [run] = await db.insert(automationRuns).values({
    tenantId,
    workflowName: 'chief-of-staff-loop',
    startedAt: new Date(),
    status: 'running',
  }).returning();

  let draftsCreated = 0;
  let skippedNoSignal = 0;

  try {
    // Get credentials
    const creds = await getDecryptedCredentials(tenantId);

    // Get VIP list
    const vips = await db.query.vipList.findMany({
      where: eq(vipList.tenantId, tenantId),
      with: { contact: true },
    });

    for (const vip of vips) {
      try {
        // Enrich contact
        const enriched = await enrichContact(vip.contact, creds.enrichment);

        // Check for job changes
        const jobChanged = detectJobChange(vip.contact, enriched);

        // Fetch news
        const news = await fetchNews(vip.contact.company, creds.news);
        const excitingNews = filterExcitingNews(news);

        // Skip if no signal
        if (!jobChanged && excitingNews.length === 0) {
          skippedNoSignal++;
          continue;
        }

        // Check if already sent for this news
        const alreadySent = await checkAlreadySent(tenantId, vip.carddavUid, excitingNews);
        if (alreadySent) {
          skippedNoSignal++;
          continue;
        }

        // Generate draft
        const draft = await generateDraft({
          contact: vip.contact,
          jobChanged,
          news: excitingNews[0],
        }, creds.llm);

        // Deliver
        await deliverToSlack(tenantId, {
          contact: vip.contact,
          draft,
          newsUrl: excitingNews[0]?.url,
        }, creds.slack);

        // Log outreach
        await db.insert(outreachLog).values({
          tenantId,
          carddavUid: vip.carddavUid,
          newsItemId: excitingNews[0]?.id,
          draftSentAt: new Date(),
          deliveryMethod: 'slack',
        });

        draftsCreated++;
      } catch (error) {
        // Log per-VIP error but continue
        console.error(`Error processing VIP ${vip.carddavUid}:`, error);
      }
    }

    // Update run as success
    await db.update(automationRuns)
      .set({
        status: 'success',
        finishedAt: new Date(),
        vipsConsidered: vips.length,
        draftsCreated,
        skippedNoSignal,
      })
      .where(eq(automationRuns.id, run.id));

  } catch (error) {
    // Update run as failed
    await db.update(automationRuns)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        errorSummary: error instanceof Error ? error.message : 'Unknown error',
      })
      .where(eq(automationRuns.id, run.id));

    throw error; // Re-throw for pg-boss retry
  }
}
```

**Retry configuration:**

```typescript
// Job options with retry
await boss.send(JOB_NAMES.CHIEF_OF_STAFF, { tenantId }, {
  retryLimit: 3,
  retryDelay: 60,        // 1 minute
  retryBackoff: true,    // Exponential backoff
  expireInMinutes: 30,   // Job timeout
});
```

**On-demand job triggering (for "Test connection"):**

```typescript
// src/app/api/integrations/[type]/test/route.ts
export async function POST(req: Request, { params }) {
  const { type } = params;
  const session = await getServerSession();

  // Enqueue immediate health check
  const jobId = await boss.send(JOB_NAMES.HEALTH_CHECK, {
    tenantId: session.user.tenantId,
    integrationType: type,
  }, {
    retryLimit: 0,  // Don't retry test connections
  });

  // Wait for result (polling or pg-boss fetch)
  const result = await waitForJobResult(jobId, { timeoutMs: 30000 });

  return Response.json(result);
}
```

**Directory structure:**

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   └── (dashboard)/       # UI pages
├── jobs/                   # Background job handlers
│   ├── index.ts           # Job type definitions
│   ├── scheduler.ts       # Cron scheduling
│   ├── contactsSync.ts    # CardDAV sync job
│   ├── vipClassifier.ts   # AI classifier job
│   ├── chiefOfStaff.ts    # Main loop job
│   └── healthCheck.ts     # Integration test job
├── lib/                    # Shared business logic
│   ├── carddav.ts         # CardDAV client
│   ├── enrichment.ts      # Apollo/Proxycurl
│   ├── news.ts            # NewsAPI/Perigon
│   ├── llm.ts             # OpenAI/Anthropic
│   ├── delivery.ts        # Slack/Sheets
│   └── encryption.ts      # Secrets encryption
├── db/                     # Database
│   ├── index.ts           # Drizzle client
│   ├── schema.ts          # Table definitions
│   └── migrations/        # SQL migrations
└── worker.ts              # Worker entry point
```

**Running the worker:**

```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "worker": "tsx watch src/worker.ts",
    "worker:prod": "node dist/worker.js",
    "dev:all": "concurrently \"pnpm dev\" \"pnpm worker\""
  }
}
```

**Production deployment:**

```yaml
# docker-compose.yml
services:
  app:
    build: .
    command: pnpm start
    # ... env vars

  worker:
    build: .
    command: pnpm worker:prod
    # Same image, different entrypoint
    # ... same env vars

  postgres:
    image: postgres:16
    # ...
```

**Monitoring jobs (API endpoint):**

```typescript
// src/app/api/admin/jobs/route.ts
export async function GET() {
  // Query pg-boss tables directly
  const recentJobs = await db.execute(sql`
    SELECT name, state, created_on, started_on, completed_on, output
    FROM pgboss.job
    WHERE created_on > NOW() - INTERVAL '24 hours'
    ORDER BY created_on DESC
    LIMIT 100
  `);

  return Response.json({ jobs: recentJobs });
}
```

**Acceptance criteria:**

- Worker process starts and registers all job handlers
- Cron jobs are scheduled per-tenant with correct timezone
- "Test connection" triggers immediate job and returns result
- Failed jobs are retried with exponential backoff
- All job runs are logged to `automation_runs` table
- Worker can be scaled horizontally (pg-boss handles locking)
- Jobs are testable with Vitest (mock DB, mock external APIs)

---

## Part 17 — Tech Stack

**Goal:** Define concrete technology choices for implementation.

**Frontend:**


| Layer      | Choice                           | Rationale                                                      |
| ---------- | -------------------------------- | -------------------------------------------------------------- |
| Framework  | **Next.js 14+ (App Router)**     | Server components, API routes, good DX; widely understood      |
| Styling    | **Tailwind CSS**                 | Utility-first; fast iteration; responsive out of box           |
| Components | **shadcn/ui**                    | Copy-paste components; not a heavy dependency; accessible      |
| State      | **React Query (TanStack Query)** | Server state caching; automatic refetch; optimistic updates    |
| Forms      | **React Hook Form + Zod**        | Validation, controlled inputs, good TypeScript support         |
| Auth       | **NextAuth.js (Auth.js)**        | Google OAuth built-in; session handling; adapters for Postgres |


**Backend:**


| Layer              | Choice                               | Rationale                                                        |
| ------------------ | ------------------------------------ | ---------------------------------------------------------------- |
| Runtime            | **Node.js (via Next.js API routes)** | Same language as frontend; serverless-compatible if needed       |
| Database           | **Postgres**                         | Single DB for app data + job queue (pg-boss tables)              |
| ORM                | **Drizzle ORM**                      | Type-safe queries; migrations; lightweight                       |
| Secrets encryption | **libsodium (sodium-native)**        | Envelope encryption; well-audited; no external KMS needed for v1 |
| Job queue          | **pg-boss**                          | Postgres-backed; cron scheduling; retries; same DB as app        |


**Infrastructure:**


| Component     | Choice                                          | Rationale                                              |
| ------------- | ----------------------------------------------- | ------------------------------------------------------ |
| Hosting       | **Single VPS (Hetzner, DigitalOcean, Railway)** | Simple for beta; can split later                       |
| CDN/Proxy     | **Cloudflare**                                  | DDoS protection, caching, analytics; free tier         |
| Database      | **Managed Postgres** or **Postgres on VPS**     | Managed (Supabase, Neon, DO) for backups; or self-host |
| Reverse proxy | **Caddy**                                       | Origin server; handles Cloudflare origin certs         |
| Monitoring    | **Sentry** (errors) + **Axiom/Logtail** (logs)  | Free tiers sufficient for beta                         |


**External services:**


| Service    | Primary choice                    | Fallback         |
| ---------- | --------------------------------- | ---------------- |
| Enrichment | **Apollo.io**                     | Proxycurl        |
| News       | **NewsAPI**                       | Perigon          |
| LLM        | **OpenAI (GPT-4o-mini for cost)** | Anthropic Claude |
| Delivery   | **Slack** (OAuth)                 | Google Sheets    |


**Development:**


| Tool            | Choice                           |
| --------------- | -------------------------------- |
| Language        | TypeScript (strict mode)         |
| Package manager | pnpm                             |
| Testing         | Vitest (unit) + Playwright (e2e) |
| Linting         | ESLint + Prettier                |
| CI/CD           | GitHub Actions                   |


**Acceptance criteria:**

- All dependencies documented in `package.json` with version constraints
- README includes local development setup instructions
- Docker Compose file for local Postgres

---

## Part 18 — API Specification

**Goal:** Define the REST API endpoints for the web application.

**Base URL:** `https://app.example.com/api`

**Authentication:** All endpoints (except public) require valid session cookie from NextAuth.

### Auth endpoints


| Method | Path                    | Description                      | Auth          |
| ------ | ----------------------- | -------------------------------- | ------------- |
| GET    | `/auth/signin`          | NextAuth Google OAuth initiation | Public        |
| GET    | `/auth/callback/google` | OAuth callback                   | Public        |
| POST   | `/auth/signout`         | End session                      | Authenticated |
| GET    | `/auth/session`         | Get current session/user         | Authenticated |


### Invite endpoints


| Method | Path                     | Description                            | Auth          |
| ------ | ------------------------ | -------------------------------------- | ------------- |
| POST   | `/invites`               | Generate new invite link               | Admin         |
| GET    | `/invites`               | List pending invites for tenant        | Admin         |
| DELETE | `/invites/:id`           | Revoke invite                          | Admin         |
| GET    | `/invites/accept/:token` | Validate invite token (public landing) | Public        |
| POST   | `/invites/accept/:token` | Accept invite (after OAuth)            | Authenticated |


**Request/Response: `POST /invites`**

```typescript
// Request
{
  type: 'tenant' | 'platform',  // platform only for platform_admin
  email_hint?: string,
  expires_in_days?: 1 | 7 | 30  // default: 7
}

// Response
{
  id: string,
  token: string,  // only returned once, on creation
  url: string,    // full invite URL
  expires_at: string
}
```

### User/tenant endpoints


| Method | Path                         | Description             | Auth          |
| ------ | ---------------------------- | ----------------------- | ------------- |
| GET    | `/users/me`                  | Current user profile    | Authenticated |
| PATCH  | `/users/me`                  | Update profile          | Authenticated |
| GET    | `/tenants/current`           | Current tenant info     | Authenticated |
| GET    | `/tenants/current/users`     | List users in tenant    | Admin         |
| PATCH  | `/tenants/current/users/:id` | Update user role        | Admin         |
| DELETE | `/tenants/current/users/:id` | Remove user from tenant | Admin         |


### Integration/wizard endpoints


| Method | Path                       | Description                                 | Auth          |
| ------ | -------------------------- | ------------------------------------------- | ------------- |
| GET    | `/integrations`            | List all integrations + status              | Authenticated |
| GET    | `/integrations/:type`      | Get single integration config (masked)      | Admin         |
| PUT    | `/integrations/:type`      | Save/update integration credentials         | Admin         |
| DELETE | `/integrations/:type`      | Disconnect integration                      | Admin         |
| POST   | `/integrations/:type/test` | Test connection (triggers health-check job) | Admin         |


**Integration types:** `carddav`, `enrichment`, `news`, `llm`, `delivery_slack`, `delivery_sheets`

**Request: `PUT /integrations/carddav`**

```typescript
{
  apple_id: string,
  app_specific_password: string,
  address_book_url?: string  // optional override
}
```

**Response: `GET /integrations/carddav`**

```typescript
{
  type: 'carddav',
  connected: true,
  configured_at: '2024-01-15T10:30:00Z',
  last_test: {
    status: 'success' | 'failed',
    at: '2024-01-15T10:31:00Z',
    error?: string  // sanitized, no secrets
  },
  config: {
    apple_id: 'rock@***.com',  // masked
    address_book_url: 'https://contacts.icloud.com/...'
  }
}
```

### Setup/wizard endpoints


| Method | Path              | Description                               | Auth          |
| ------ | ----------------- | ----------------------------------------- | ------------- |
| GET    | `/setup/status`   | Wizard progress (which steps complete)    | Authenticated |
| POST   | `/setup/complete` | Mark setup complete (validates all green) | Admin         |


**Response: `GET /setup/status`**

```typescript
{
  completed: false,
  steps: [
    { id: 'carddav', label: 'iCloud Contacts', status: 'complete' },
    { id: 'enrichment', label: 'Contact Enrichment', status: 'pending' },
    { id: 'news', label: 'News Source', status: 'pending' },
    { id: 'llm', label: 'AI Provider', status: 'pending' },
    { id: 'delivery', label: 'Delivery', status: 'pending' },
    { id: 'schedule', label: 'Schedule', status: 'pending' }
  ],
  current_step: 'enrichment'
}
```

### Dashboard endpoints


| Method | Path                  | Description                        | Auth          |
| ------ | --------------------- | ---------------------------------- | ------------- |
| GET    | `/dashboard/health`   | Integration health cards           | Authenticated |
| GET    | `/dashboard/runs`     | Automation run history             | Authenticated |
| GET    | `/dashboard/runs/:id` | Single run detail                  | Authenticated |
| GET    | `/dashboard/stats`    | Summary stats (VIPs, drafts, etc.) | Authenticated |


**Response: `GET /dashboard/runs`**

```typescript
{
  runs: [
    {
      id: string,
      workflow: 'chief-of-staff-loop',
      started_at: string,
      finished_at: string,
      status: 'success' | 'partial' | 'failed',
      vips_considered: 12,
      drafts_created: 3,
      skipped_no_signal: 9,
      error_summary?: string
    }
  ],
  pagination: { page: 1, per_page: 20, total: 45 }
}
```

### Admin console endpoints (platform admin only)


| Method | Path                 | Description                   | Auth           |
| ------ | -------------------- | ----------------------------- | -------------- |
| GET    | `/admin/tenants`     | List all tenants              | Platform Admin |
| GET    | `/admin/tenants/:id` | Tenant detail                 | Platform Admin |
| PATCH  | `/admin/tenants/:id` | Update tenant (suspend, etc.) | Platform Admin |
| DELETE | `/admin/tenants/:id` | Delete tenant                 | Platform Admin |
| GET    | `/admin/stats`       | Platform-wide stats           | Platform Admin |


### Job management endpoints (admin)


| Method | Path                  | Description                       | Auth           |
| ------ | --------------------- | --------------------------------- | -------------- |
| GET    | `/admin/jobs`         | List recent jobs (pg-boss status) | Platform Admin |
| GET    | `/admin/jobs/:id`     | Get job details and result        | Platform Admin |
| POST   | `/admin/jobs/trigger` | Manually trigger a job for tenant | Platform Admin |


**Acceptance criteria:**

- All endpoints return consistent JSON structure with `data` or `error` wrapper
- All mutations return the updated resource
- Pagination on list endpoints (default 20, max 100)
- Error responses include `code` and `message`
- Rate limiting: 100 req/min for authenticated, 10 req/min for public

---

## Part 19 — Error Handling & Observability

**Goal:** Consistent error handling, useful logs, and alerting for operational issues.

**Error response format:**

```typescript
{
  error: {
    code: 'INVALID_CREDENTIALS',  // machine-readable
    message: 'The CardDAV credentials could not authenticate.',  // human-readable
    details?: {  // optional extra context
      field: 'app_specific_password'
    }
  }
}
```

**Error codes (partial list):**


| Code                  | HTTP Status | Meaning                                 |
| --------------------- | ----------- | --------------------------------------- |
| `UNAUTHORIZED`        | 401         | No valid session                        |
| `FORBIDDEN`           | 403         | Valid session but insufficient role     |
| `NOT_FOUND`           | 404         | Resource doesn't exist or not in tenant |
| `VALIDATION_ERROR`    | 400         | Request body failed schema validation   |
| `INVALID_CREDENTIALS` | 400         | Integration credentials didn't work     |
| `INVITE_EXPIRED`      | 400         | Invite token past expiration            |
| `INVITE_ALREADY_USED` | 400         | Invite already accepted                 |
| `RATE_LIMITED`        | 429         | Too many requests                       |
| `INTEGRATION_ERROR`   | 502         | External API (Apollo, NewsAPI) failed   |
| `JOB_FAILED`          | 500         | Background job execution failed         |


**Logging strategy:**


| Level   | When                                        | Example                                    |
| ------- | ------------------------------------------- | ------------------------------------------ |
| `error` | Unhandled exceptions, external API failures | "Apollo API returned 500"                  |
| `warn`  | Expected failures, rate limits, retries     | "Rate limited by NewsAPI, backing off"     |
| `info`  | Key operations                              | "User X completed setup", "Run Y finished" |
| `debug` | Detailed flow (dev only)                    | "Fetched 142 contacts from CardDAV"        |


**Log format (structured JSON):**

```json
{
  "level": "info",
  "message": "Automation run completed",
  "tenant_id": "uuid",
  "workflow": "chief-of-staff-loop",
  "duration_ms": 4523,
  "drafts_created": 3,
  "request_id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Never log:**

- Passwords, API keys, tokens
- Full vCard content (PII)
- LLM prompts containing contact details
- Draft message content

**Alerting (Sentry + email/Slack):**


| Condition                                               | Alert                   |
| ------------------------------------------------------- | ----------------------- |
| Error rate > 10% in 5 minutes                           | Slack notification      |
| Any `INTEGRATION_ERROR` for specific tenant 3x in a row | Email to platform admin |
| Background job fails after all retries                  | Sentry alert            |
| Disk/memory > 90%                                       | Infrastructure alert    |


**Health check endpoints:**


| Path             | Checks                               |
| ---------------- | ------------------------------------ |
| `/health`        | Web app alive (200 OK)               |
| `/health/db`     | Postgres connection                  |
| `/health/worker` | pg-boss can connect and process jobs |


**Acceptance criteria:**

- All API errors return consistent JSON format
- Logs are structured JSON, shipped to log aggregator
- No secrets appear in logs (audit before launch)
- Sentry captures unhandled exceptions with context
- Health endpoints exist for uptime monitoring

---

## Part 20 — Deployment & Infrastructure

**Goal:** Simple, reproducible deployment for beta (2-3 clients + you).

**Single-server architecture (v1):**

```
┌─────────────────────────────────────────────────────┐
│                  VPS (4GB+ RAM)                      │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │   Caddy     │  │  Next.js    │  │   Worker    │  │
│  │  (reverse   │  │  (port 3000)│  │  (pg-boss)  │  │
│  │   proxy)    │  │  API + UI   │  │  bg jobs    │  │
│  │  :80/:443   │  │             │  │             │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  │
│         │                │                │         │
│         │         ┌──────┴────────────────┘         │
│         │         │                                  │
│         │    ┌────▼─────┐                           │
│         │    │ Postgres │                           │
│         │    │ + pgboss │                           │
│         │    │  tables  │                           │
│         └───►│          │                           │
│              └──────────┘                           │
└─────────────────────────────────────────────────────┘
```

**Domain & DNS (Cloudflare):**

```
┌──────────────┐      ┌─────────────┐      ┌─────────────┐
│   Browser    │ ───► │  Cloudflare │ ───► │    VPS      │
│              │      │  (proxy)    │      │  (origin)   │
└──────────────┘      └─────────────┘      └─────────────┘
     HTTPS              Edge SSL            Origin cert
```

**Cloudflare setup:**

1. **Add domain** to Cloudflare; update registrar nameservers
2. **DNS records:**
  - `A` record: `app` → VPS IP (Proxied / orange cloud ON)
  - `A` record: `@` → VPS IP (for root domain redirect, optional)
3. **SSL/TLS mode:** `Full (Strict)` — Cloudflare encrypts to origin; origin has valid cert
4. **Origin certificate:** Generate in Cloudflare dashboard → install on Caddy (15-year cert, free)
5. **Page rules (optional):**
  - `http://*example.com/`* → Always Use HTTPS
  - Cache static assets (`/assets/`*, `/_next/static/`*)

**Caddyfile (with Cloudflare origin cert):**

```
app.example.com {
    tls /etc/caddy/certs/cloudflare-origin.pem /etc/caddy/certs/cloudflare-origin-key.pem
    reverse_proxy localhost:3000
}
```

**Alternative: Let Caddy handle HTTPS (simpler, but no Cloudflare proxy benefits):**

```
app.example.com {
    reverse_proxy localhost:3000
}
# Set Cloudflare DNS to "DNS only" (grey cloud) if using this approach
```

**Cloudflare security settings:**


| Setting           | Value                        | Why                              |
| ----------------- | ---------------------------- | -------------------------------- |
| SSL mode          | Full (Strict)                | End-to-end encryption            |
| Always Use HTTPS  | On                           | Redirect HTTP → HTTPS            |
| Minimum TLS       | 1.2                          | Modern clients only              |
| Bot Fight Mode    | On                           | Block known bad bots             |
| Under Attack Mode | Off (toggle if attacked)     | CAPTCHA challenge                |
| Firewall rules    | Allow Google OAuth callbacks | Prevent blocking OAuth redirects |


**Firewall rule for OAuth:**

```
(http.request.uri.path contains "/api/auth/callback") → Allow
```

**Docker Compose (recommended):**

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: chiefofstaff
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d chiefofstaff"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build: .
    command: pnpm start
    environment:
      - DATABASE_URL=postgres://app:${DB_PASSWORD}@postgres:5432/chiefofstaff
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - PLATFORM_ADMIN_EMAIL=${PLATFORM_ADMIN_EMAIL}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - SENTRY_DSN=${SENTRY_DSN}
    ports:
      - "127.0.0.1:3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  worker:
    build: .
    command: pnpm worker:prod
    environment:
      - DATABASE_URL=postgres://app:${DB_PASSWORD}@postgres:5432/chiefofstaff
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - SENTRY_DSN=${SENTRY_DSN}
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - ./certs:/etc/caddy/certs:ro
      - caddy_data:/data
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  caddy_data:
```

**Environment variables (.env):**

```env
# Database
DB_PASSWORD=<generate-random-32-chars>

# Auth
NEXTAUTH_SECRET=<generate-random-32-chars>
NEXTAUTH_URL=https://app.example.com
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>

# Bootstrap
PLATFORM_ADMIN_EMAIL=you@example.com

# Secrets encryption (for integration credentials)
ENCRYPTION_KEY=<generate-32-bytes-base64>

# Observability
SENTRY_DSN=<from-sentry>
LOG_LEVEL=info
```

**Backup strategy:**

- **Postgres:** Daily pg_dump to S3/B2 (via cron or managed backup)
- **Code:** All logic in git; no external workflow state to backup
- **Retention:** 30 days rolling

**Deployment process:**

1. Push to `main` branch
2. GitHub Actions: build Docker image, push to registry
3. SSH to VPS: `docker compose pull && docker compose up -d`
4. Run migrations: `docker compose exec app pnpm db:migrate`

**Rollback:**

- Keep last 3 image tags
- Rollback: `docker compose pull app:previous && docker compose up -d app`

**Scaling (when needed, post-beta):**


| Bottleneck     | Solution                                           |
| -------------- | -------------------------------------------------- |
| Database       | Move to managed Postgres (Supabase, Neon, RDS)     |
| Job throughput | Multiple worker replicas (pg-boss handles locking) |
| Web app        | Horizontal scale behind load balancer              |
| Multi-region   | Fly.io or Railway with Postgres replicas           |


**Acceptance criteria:**

- Single `docker compose up` starts entire stack
- HTTPS works automatically (Caddy + Let's Encrypt)
- Worker process runs alongside app
- Backups run daily; tested restore procedure documented
- Zero-downtime deploys (rolling restart)

---

## Part 21 — Testing Strategy

**Goal:** Sufficient test coverage for confidence in deployments without over-engineering for a beta product.

**Testing pyramid:**

```
         ┌───────────────┐
         │    E2E (5)    │  ← Critical user flows only
         ├───────────────┤
         │ Integration   │  ← API routes, DB queries
         │    (20-30)    │
         ├───────────────┤
         │    Unit       │  ← Pure functions, utilities
         │   (50-100)    │
         └───────────────┘
```

**Unit tests (Vitest):**


| Area        | What to test                                                 |
| ----------- | ------------------------------------------------------------ |
| Encryption  | `encrypt()` / `decrypt()` round-trip; invalid input handling |
| Validation  | Zod schemas for all API inputs                               |
| Permissions | `canUserPerformAction(user, action, resource)`               |
| Utilities   | Date formatting, token generation, mask functions            |


**Integration tests (Vitest + test DB):**


| Area         | What to test                                        |
| ------------ | --------------------------------------------------- |
| Auth         | Google OAuth callback creates user/tenant correctly |
| Invites      | Generate → accept → user added to tenant            |
| Integrations | Save credentials → masked in GET response           |
| Dashboard    | Run history query returns correct tenant data       |
| RBAC         | Admin can manage users; member cannot               |


**E2E tests (Playwright):**


| Flow             | Steps                                                     |
| ---------------- | --------------------------------------------------------- |
| Bootstrap        | First user signs in → becomes platform admin              |
| Invite flow      | Admin generates link → new user accepts → lands in wizard |
| Setup wizard     | Complete all steps → redirected to dashboard              |
| Integration test | Enter CardDAV creds → "Test connection" → green status    |
| Dashboard        | View run history → click into detail                      |


**Background job testing:**

- **Direct invocation:** Job handlers are regular async functions; call directly in tests
- **Mock data:** Test with synthetic contacts/news, not real APIs
- **Dry run flag:** `DRY_RUN=true` env var skips Slack/Sheet delivery, logs instead

**Test data strategy:**

- **Seed script:** `pnpm db:seed` creates test tenant, users, sample contacts, mock runs
- **Fixtures:** JSON files for mock API responses (Apollo, NewsAPI)
- **Isolation:** Each test run uses transaction rollback or fresh schema

**CI pipeline:**

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test:unit
      - run: pnpm test:integration
        env:
          DATABASE_URL: postgres://test@localhost/test
      # E2E runs on deploy preview only (expensive)
```

**What NOT to test (v1):**

- External API behavior (mock instead)
- pg-boss internals (trust the library; test your job handlers)
- CSS/styling (visual regression is phase 2)
- Performance benchmarks

**Acceptance criteria:**

- `pnpm test` runs all unit + integration tests in < 60 seconds
- CI blocks merge on test failure
- E2E tests run on staging deploy
- Test coverage > 60% for `src/lib` (business logic)

---

## Part 22 — 2-Week Sprint Plan

**Goal:** Ship full spec in 14 days with ~12-14 hour workdays.

**Prerequisites (Day 0 prep):**

- Buy domain name
- Set up Cloudflare account
- Create Proxycurl account (free trial)
- Create Resend account (free tier)
- Have DeepSeek API key ready
- Proxmox VM ready with Docker installed
- Google Cloud Console project for OAuth

### Week 1: Foundation + Wizard


| Day   | Focus           | Morning (4-5 hrs)                 | Afternoon (4-5 hrs)               | Evening (3-4 hrs)                   |
| ----- | --------------- | --------------------------------- | --------------------------------- | ----------------------------------- |
| **1** | Setup           | Next.js + Tailwind + shadcn       | Drizzle + Postgres schema         | Docker Compose + local dev          |
| **2** | Auth            | NextAuth + Google OAuth           | PLATFORM_ADMIN_EMAIL bootstrap    | Session handling + protected routes |
| **3** | Invites         | Invite generation + token hashing | Accept flow + tenant creation     | Invite list UI + revoke             |
| **4** | Wizard UI       | Step framework + progress bar     | Routing logic + state persistence | Responsive layout + polish          |
| **5** | iCloud Sync     | CardDAV client (`tsdav`)          | contacts-sync job handler         | Test with real iCloud account       |
| **6** | Google Contacts | OAuth scope for Contacts          | google-contacts-sync job          | Merge logic for duplicates          |
| **7** | CSV Upload      | Upload UI + drag-drop             | CSV parser + validation           | Import job + error handling         |


### Week 2: Intelligence + Delivery


| Day    | Focus          | Morning (4-5 hrs)          | Afternoon (4-5 hrs)            | Evening (3-4 hrs)               |
| ------ | -------------- | -------------------------- | ------------------------------ | ------------------------------- |
| **8**  | Enrichment     | Proxycurl client           | Enrichment job handler         | Handle missing data gracefully  |
| **9**  | News           | Google RSS parser          | Bing News API fallback         | Relevance filter with DeepSeek  |
| **10** | LLM + Drafts   | DeepSeek client            | Draft generation prompts       | Warm/personal tone tuning       |
| **11** | VIP Classifier | Classification prompts     | **VIP approval UI** (polished) | Batch processing for 200+       |
| **12** | Email Digest   | Resend integration         | HTML email template            | Daily job at 7 AM per timezone  |
| **13** | Dashboard      | Health cards + run history | VIP list view                  | Admin console basics            |
| **14** | Deploy + Test  | Production Docker deploy   | End-to-end testing             | Bug fixes + first tenant invite |


### Daily Checklist Template

```
Morning standup (5 min):
- [ ] What did I complete yesterday?
- [ ] What's blocking me?
- [ ] What will I complete today?

End of day (10 min):
- [ ] Commit all changes
- [ ] Update progress in this doc
- [ ] Note any blockers for tomorrow
- [ ] Quick test of today's work
```

### Risk Mitigation


| Risk                      | Mitigation                                                   |
| ------------------------- | ------------------------------------------------------------ |
| CardDAV auth issues       | Have iCloud app-specific password ready; test early on Day 5 |
| API rate limits           | Build retry logic from Day 1; use exponential backoff        |
| Google OAuth scope issues | Test Contacts scope on Day 6 morning; have fallback to CSV   |
| DeepSeek API issues       | Have OpenAI key as backup                                    |
| Email deliverability      | Use Resend's test mode; verify domain early                  |
| Running behind schedule   | Cut VIP approval polish first; use simple list instead       |


### Definition of Done (Day 14)

- You can sign up via Google OAuth (first user = platform admin)
- You can generate invite links and onboard a beta tenant
- Tenant can complete wizard with at least one contact source
- Contacts sync to database and appear in dashboard
- VIP classifier runs and shows suggestions in approval UI
- Approved VIPs are tracked for news
- Daily digest email arrives at 7 AM with any drafts
- Dashboard shows integration health and run history
- Admin console lets you see all tenants
- Everything runs on Proxmox with Cloudflare in front

---

## What we're not building (scope)

- No automatic sending of messages to contacts (human always sends).
- No in-app email sending for invites (admin copies link, sends manually).
- No "human support asks you to paste secrets in chat"—all secrets via **web OAuth/API key UI** only.
- No in-app replacement for full Apple Contacts editing (CardDAV remains read-oriented for sync; optional future scope).
- No generic "compose from scratch" in v1; only draft-from-news/job-change signals.
- No Stripe/in-app billing in v1 (manual invoicing).
- No DPA in v1 (phase 2).
- No dark mode (light only for v1).
- No real-time notifications (daily digest only).

This plan is the spec. Each "Acceptance criteria" bullet is a testable condition; implementation can be done step-by-step against this document.

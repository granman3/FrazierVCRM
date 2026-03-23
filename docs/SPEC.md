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
  subgraph server [Your VPS / Proxmox]
    subgraph app [Next.js App]
      UI[Wizard + Dashboard]
      API[API Routes]
    end
    Worker[pg-boss Worker]
    DB[(Postgres + pg-boss)]
  end
  subgraph sources [Contact Sources]
    iCloud[iCloud CardDAV]
    Google[Google Contacts API]
    CSV[CSV Upload]
  end
  subgraph external [External APIs]
    Proxycurl[Proxycurl]
    NewsRSS[Google RSS]
    BingNews[Bing News API]
    DeepSeek[DeepSeek V3]
  end
  subgraph delivery [Delivery]
    Resend[Resend Email]
  end
  Browser --> CF
  CF --> UI
  UI --> API
  API --> DB
  Worker --> DB
  Worker --> iCloud
  Worker --> Google
  Worker --> Proxycurl
  Worker --> NewsRSS
  Worker --> BingNews
  Worker --> DeepSeek
  Worker --> Resend
```

**Data flow summary:**

1. **Contact Sync:** Worker pulls contacts from iCloud (CardDAV), Google (People API), or CSV upload → stores in `contacts_snapshot`
2. **VIP Classification:** Worker sends contact batches to DeepSeek → stores suggestions in `vip_candidates` → user approves in dashboard
3. **Daily Loop (7 AM):** Worker checks approved VIPs → Proxycurl for job changes → Google RSS/Bing for news → DeepSeek for drafts → Resend for email digest



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
  - Purpose: Output of classifier; you set `approved` via in-app approval UI.
4. **vip_list**
  - `carddav_uid` (PK), `added_at`.
  - Purpose: Only contacts with `approved = true` get copied here; main loop reads from this.
5. **outreach_log**
  - `id`, `carddav_uid`, `news_item_id`, `draft_sent_at`, `delivery_method`, `delivery_payload` (e.g. email message ID).
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

## Part 2 — Contact Sources Spec

**Goal:** Import contacts from multiple sources (iCloud, Google Contacts, CSV) into a unified `contacts_snapshot` table with deduplication.

---

### 2.1 — iCloud Contacts (CardDAV)

**Protocol:** CardDAV (RFC 6352) over HTTPS with Basic Auth using app-specific password.

**Authentication:**

```typescript
// Credentials required
interface ICloudCredentials {
  appleId: string;           // user's Apple ID email
  appSpecificPassword: string; // 16-char app-specific password from appleid.apple.com
}

// CardDAV endpoints
const ICLOUD_CARDDAV = {
  principal: 'https://contacts.icloud.com/',
  discovery: '/.well-known/carddav',
};
```

**App-Specific Password Setup (user instructions):**

1. Go to [appleid.apple.com](https://appleid.apple.com) → Sign-In and Security → App-Specific Passwords
2. Click "+" to generate a new password
3. Name it "Chief of Staff" (or similar)
4. Copy the 16-character password (format: `xxxx-xxxx-xxxx-xxxx`)
5. Paste into the wizard

**Sync Process:**

```typescript
// Step 1: Discover principal URL
async function discoverPrincipal(creds: ICloudCredentials): Promise<string> {
  // PROPFIND on /.well-known/carddav with current-user-principal
  // Returns: /123456789/principal/
}

// Step 2: Get address book home
async function getAddressBookHome(principalUrl: string): Promise<string> {
  // PROPFIND with addressbook-home-set property
  // Returns: /123456789/carddavhome/
}

// Step 3: List address books
async function listAddressBooks(homeUrl: string): Promise<AddressBook[]> {
  // PROPFIND with resourcetype, displayname
  // Returns: [{ url: '/123456789/carddavhome/card/', name: 'Contacts' }]
}

// Step 4: Fetch all vCards
async function fetchAllVCards(addressBookUrl: string): Promise<VCard[]> {
  // REPORT with addressbook-query, request all properties
  // Returns array of vCard strings
}

// Step 5: Parse vCards
interface ParsedContact {
  uid: string;        // vCard UID
  etag: string;       // For change detection
  fullName: string;   // FN property
  company?: string;   // ORG property (first value)
  title?: string;     // TITLE property
  emails: string[];   // EMAIL properties (all)
  phones: string[];   // TEL properties (all)
  linkedinUrl?: string; // URL property containing 'linkedin.com'
  rawVcard: string;   // Original vCard for debugging
}
```

**vCard Parsing (key fields):**

```
BEGIN:VCARD
VERSION:3.0
UID:12345-67890-abcdef
FN:John Smith
N:Smith;John;;;
ORG:Acme Ventures;
TITLE:Managing Partner
EMAIL;TYPE=WORK:john@acmevc.com
EMAIL;TYPE=HOME:john.smith@gmail.com
TEL;TYPE=CELL:+1-555-123-4567
URL:https://linkedin.com/in/johnsmith
END:VCARD
```

**Incremental Sync (optimization):**

```typescript
// Use ctag (collection tag) to detect changes
async function hasCollectionChanged(addressBookUrl: string, lastCtag: string): Promise<boolean> {
  // PROPFIND for getctag property
  // Compare with stored lastCtag
}

// Use etag per contact for granular sync
async function syncChangedContacts(addressBookUrl: string, knownEtags: Map<string, string>) {
  // REPORT with sync-collection
  // Only fetch vCards where etag changed
}
```

**Implementation (tsdav library):**

```typescript
import { createDAVClient } from 'tsdav';

const client = await createDAVClient({
  serverUrl: 'https://contacts.icloud.com',
  credentials: {
    username: appleId,
    password: appSpecificPassword,
  },
  authMethod: 'Basic',
  defaultAccountType: 'carddav',
});

const addressBooks = await client.fetchAddressBooks();
const vCards = await client.fetchVCards({ addressBook: addressBooks[0] });
```

**Error Handling:**

| Error | Cause | User Message |
|-------|-------|--------------|
| 401 Unauthorized | Bad password or expired | "Authentication failed. Please generate a new app-specific password." |
| 403 Forbidden | 2FA not set up | "Please enable two-factor authentication on your Apple ID." |
| 404 Not Found | No address book | "No contacts found. Please check your iCloud Contacts." |
| Network timeout | Apple servers slow | "iCloud is taking longer than usual. We'll retry automatically." |

---

### 2.2 — Google Contacts (People API)

**Protocol:** OAuth 2.0 + Google People API v1

**OAuth Scopes:**

```typescript
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/contacts.readonly', // Read contacts
  'https://www.googleapis.com/auth/userinfo.email',    // Get user email (for login)
  'https://www.googleapis.com/auth/userinfo.profile',  // Get user name/photo
];
```

**OAuth Flow (NextAuth handles most of this):**

```typescript
// 1. User clicks "Connect Google Contacts"
// 2. Redirect to Google OAuth consent screen
// 3. User approves scopes
// 4. Callback with authorization code
// 5. Exchange code for access_token + refresh_token
// 6. Store encrypted tokens in integration_secrets

interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;  // Unix timestamp
}
```

**People API Requests:**

```typescript
// List all contacts (paginated)
// GET https://people.googleapis.com/v1/people/me/connections
const params = {
  personFields: 'names,emailAddresses,phoneNumbers,organizations,urls,metadata',
  pageSize: 1000,  // Max per request
  pageToken: nextPageToken,  // For pagination
  sortOrder: 'LAST_MODIFIED_DESCENDING',
};

// Response shape
interface GooglePerson {
  resourceName: string;  // 'people/c1234567890'
  etag: string;
  metadata: {
    sources: [{ type: 'CONTACT', id: string }];
  };
  names?: [{ displayName: string }];
  emailAddresses?: [{ value: string, type?: string }];
  phoneNumbers?: [{ value: string, type?: string }];
  organizations?: [{ name?: string, title?: string }];
  urls?: [{ value: string, type?: string }];
}
```

**Mapping to contacts_snapshot:**

```typescript
function mapGooglePerson(person: GooglePerson): Partial<ContactSnapshot> {
  return {
    sourceType: 'google',
    sourceId: person.resourceName,  // 'people/c1234567890'
    fullName: person.names?.[0]?.displayName ?? 'Unknown',
    company: person.organizations?.[0]?.name,
    title: person.organizations?.[0]?.title,
    email: person.emailAddresses?.[0]?.value,
    phone: person.phoneNumbers?.[0]?.value,
    linkedinUrl: person.urls?.find(u => u.value?.includes('linkedin.com'))?.value,
  };
}
```

**Sync Strategy:**

```typescript
// Full sync on first connection
async function fullSync(tenantId: string, tokens: GoogleTokens) {
  let pageToken: string | undefined;
  do {
    const response = await fetchConnections(tokens.accessToken, pageToken);
    for (const person of response.connections) {
      await upsertContact(tenantId, mapGooglePerson(person));
    }
    pageToken = response.nextPageToken;
  } while (pageToken);
}

// Incremental sync using syncToken (daily job)
async function incrementalSync(tenantId: string, syncToken: string) {
  // GET /people/me/connections?syncToken=...
  // Returns only changed contacts since last sync
}
```

**Token Refresh:**

```typescript
async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  return {
    accessToken: data.access_token,
    refreshToken: refreshToken,  // Refresh token doesn't change
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
```

---

### 2.3 — CSV Upload

**Supported Formats:**

| Format | Extension | Notes |
|--------|-----------|-------|
| Standard CSV | `.csv` | Comma-separated, UTF-8 |
| Excel export | `.csv` | May have BOM, handle encoding |
| Google Contacts export | `.csv` | Specific column names |
| Apple Contacts export | `.vcf` | Parse as vCard, not CSV |

**Required/Optional Columns:**

```typescript
interface CSVColumnMapping {
  // Required (at least one)
  fullName?: string;       // or split into firstName + lastName
  firstName?: string;
  lastName?: string;

  // Optional but valuable
  email?: string;
  company?: string;
  title?: string;
  phone?: string;
  linkedinUrl?: string;

  // Auto-detected column names
  aliases: {
    fullName: ['name', 'full name', 'display name', 'contact name'],
    firstName: ['first name', 'first', 'given name'],
    lastName: ['last name', 'last', 'family name', 'surname'],
    email: ['email', 'e-mail', 'email address', 'primary email'],
    company: ['company', 'organization', 'org', 'employer'],
    title: ['title', 'job title', 'position', 'role'],
    phone: ['phone', 'telephone', 'mobile', 'cell'],
    linkedinUrl: ['linkedin', 'linkedin url', 'linkedin profile'],
  };
}
```

**Upload Flow:**

```typescript
// 1. User uploads file in wizard
// 2. Server parses first 5 rows for preview
// 3. Auto-detect column mapping (fuzzy match headers)
// 4. User confirms/adjusts mapping
// 5. Full parse with validation
// 6. Show summary: X contacts found, Y warnings
// 7. User confirms import
// 8. Background job processes import

interface CSVUploadResult {
  totalRows: number;
  validContacts: number;
  skippedRows: number;
  warnings: Array<{
    row: number;
    field: string;
    message: string;  // e.g., "Invalid email format"
  }>;
}
```

**Validation Rules:**

```typescript
const validationRules = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    required: false,
    errorMessage: 'Invalid email format',
  },
  phone: {
    // Allow various formats, normalize later
    pattern: /^[\d\s\-\+\(\)\.]+$/,
    required: false,
    errorMessage: 'Invalid phone format',
  },
  linkedinUrl: {
    pattern: /linkedin\.com\/(in|company)\//i,
    required: false,
    errorMessage: 'Invalid LinkedIn URL',
  },
  fullName: {
    minLength: 2,
    maxLength: 100,
    required: true,
    errorMessage: 'Name is required',
  },
};
```

**Example CSV:**

```csv
Name,Email,Company,Title,LinkedIn
John Smith,john@acmevc.com,Acme Ventures,Managing Partner,https://linkedin.com/in/johnsmith
Sarah Johnson,sarah@techcorp.io,TechCorp,CEO,https://linkedin.com/in/sarahjohnson
```

---

### 2.4 — Contact Deduplication & Merge

**Problem:** Same person may exist in multiple sources with slight variations.

**Identity Matching Strategy:**

```typescript
// Priority order for matching
const MATCH_STRATEGIES = [
  // Exact email match (highest confidence)
  { field: 'email', type: 'exact', confidence: 1.0 },

  // LinkedIn URL match (very high confidence)
  { field: 'linkedinUrl', type: 'exact', confidence: 0.95 },

  // Name + Company fuzzy match (medium confidence)
  { field: ['fullName', 'company'], type: 'fuzzy', confidence: 0.7 },

  // Name + Domain fuzzy match (medium confidence)
  { field: ['fullName', 'emailDomain'], type: 'fuzzy', confidence: 0.65 },
];
```

**Fuzzy Matching Algorithm:**

```typescript
import { distance as levenshtein } from 'fastest-levenshtein';

function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ');     // Normalize whitespace
}

function fuzzyMatch(a: string, b: string, threshold = 0.85): boolean {
  const na = normalizeString(a);
  const nb = normalizeString(b);

  // Exact match after normalization
  if (na === nb) return true;

  // Levenshtein similarity
  const maxLen = Math.max(na.length, nb.length);
  const dist = levenshtein(na, nb);
  const similarity = 1 - dist / maxLen;

  return similarity >= threshold;
}

// Name-specific matching (handles "John Smith" vs "Smith, John")
function nameMatch(a: string, b: string): boolean {
  const tokensA = new Set(normalizeString(a).split(' '));
  const tokensB = new Set(normalizeString(b).split(' '));

  // Check if significant overlap
  const intersection = [...tokensA].filter(t => tokensB.has(t));
  const union = new Set([...tokensA, ...tokensB]);

  const jaccard = intersection.length / union.size;
  return jaccard >= 0.6;  // At least 60% token overlap
}
```

**Merge Strategy:**

```typescript
interface MergedContact {
  primarySourceType: 'icloud' | 'google' | 'csv';
  primarySourceId: string;
  linkedSources: Array<{ type: string; id: string }>;

  // Merged data (prefer non-null, most recent)
  fullName: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
}

function mergeContacts(contacts: ContactSnapshot[]): MergedContact {
  // Sort by last_synced_at descending (most recent first)
  const sorted = [...contacts].sort((a, b) =>
    b.lastSyncedAt.getTime() - a.lastSyncedAt.getTime()
  );

  // Primary = most recently synced
  const primary = sorted[0];

  // Merge fields: prefer non-null, then most recent
  return {
    primarySourceType: primary.sourceType,
    primarySourceId: primary.sourceId,
    linkedSources: sorted.slice(1).map(c => ({
      type: c.sourceType,
      id: c.sourceId,
    })),
    fullName: primary.fullName,
    company: sorted.find(c => c.company)?.company,
    title: sorted.find(c => c.title)?.title,
    email: sorted.find(c => c.email)?.email,
    phone: sorted.find(c => c.phone)?.phone,
    linkedinUrl: sorted.find(c => c.linkedinUrl)?.linkedinUrl,
  };
}
```

**Database Schema Update:**

```sql
-- contacts_snapshot now tracks source
ALTER TABLE contacts_snapshot ADD COLUMN source_type VARCHAR(20) NOT NULL DEFAULT 'icloud';
ALTER TABLE contacts_snapshot ADD COLUMN source_id VARCHAR(255) NOT NULL;

-- Unique constraint per source
ALTER TABLE contacts_snapshot ADD CONSTRAINT unique_source
  UNIQUE (tenant_id, source_type, source_id);

-- Merged contacts view (or materialized table)
CREATE TABLE contacts_merged (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  primary_source_type VARCHAR(20) NOT NULL,
  primary_source_id VARCHAR(255) NOT NULL,
  linked_sources JSONB DEFAULT '[]',
  full_name VARCHAR(255) NOT NULL,
  company VARCHAR(255),
  title VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  linkedin_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (tenant_id, primary_source_type, primary_source_id)
);

-- Index for duplicate detection
CREATE INDEX idx_contacts_email ON contacts_snapshot (tenant_id, LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_linkedin ON contacts_snapshot (tenant_id, linkedin_url) WHERE linkedin_url IS NOT NULL;
CREATE INDEX idx_contacts_name_company ON contacts_snapshot (tenant_id, LOWER(full_name), LOWER(company));
```

**Acceptance Criteria (Contact Sources):**

- iCloud sync works with app-specific password; handles 401/403 errors gracefully
- Google Contacts OAuth grants `contacts.readonly` scope; tokens refresh automatically
- CSV upload auto-detects column mapping; validates data before import
- Duplicate contacts are merged by email (exact) or name+company (fuzzy)
- All sources write to `contacts_snapshot` with `source_type` and `source_id`
- `contacts_merged` table contains deduplicated contacts for VIP classification
- Sync jobs are idempotent; re-running produces same result
- User can disconnect a source; its contacts are marked (not deleted) in snapshot

---

## Part 3 — VIP Classifier Spec

**Goal:** Use DeepSeek to analyze all contacts and suggest which ones are VIPs worth tracking. User approves suggestions in-app; approved contacts are added to `vip_list` for daily monitoring.

---

### 3.1 — Classification Criteria

**Who qualifies as a VIP (for a VC user):**

| Category | Examples | Priority |
|----------|----------|----------|
| Portfolio founders | CEOs/CTOs of companies you've invested in | Critical |
| LPs (Limited Partners) | Family offices, fund-of-funds, HNW individuals | Critical |
| Co-investors | Partners at other VC firms you syndicate with | High |
| Potential LPs | People who might invest in your next fund | High |
| Deal flow sources | Founders, angels, accelerator partners who send deals | High |
| Industry experts | Advisors, board members, domain specialists | Medium |
| Service providers | Lawyers, accountants, recruiters for portfolio | Medium |
| Personal network | Friends, mentors who warrant staying in touch | Low |

**Signals that indicate VIP status:**

```typescript
interface VIPSignals {
  // Title-based signals
  titleSignals: [
    'CEO', 'CTO', 'CFO', 'COO', 'CMO',  // C-suite
    'Founder', 'Co-Founder', 'Co-founder',
    'Partner', 'Managing Partner', 'General Partner',
    'Principal', 'Vice President', 'VP',
    'Director', 'Head of', 'Chief',
    'Board Member', 'Advisor', 'Chairman',
  ],

  // Company-based signals
  companySignals: [
    // Known VC firms (could be LP or co-investor)
    // Known portfolio companies
    // Known accelerators (YC, Techstars, etc.)
  ],

  // Domain-based signals (from email)
  domainSignals: [
    'vc.com', 'ventures.com', 'capital.com',  // VC firms
    'family.office', 'fo.com',  // Family offices
  ],
}
```

---

### 3.2 — DeepSeek Prompts

**System Prompt (set once per session):**

```
You are a relationship intelligence assistant for venture capital professionals. Your job is to analyze contact lists and identify VIPs (Very Important Persons) who warrant proactive relationship maintenance.

A VIP is someone the user should stay in regular contact with for professional reasons:
- Portfolio company founders and executives
- Limited Partners (LPs) and potential investors
- Co-investors and syndicate partners
- Key advisors and board members
- Important deal flow sources

You will receive batches of contacts with name, company, title, and email. For each batch:
1. Identify which contacts are likely VIPs
2. Provide a confidence score (0.0 to 1.0)
3. Explain why in 1-2 sentences
4. Suggest a category

Respond in JSON format only. Do not include contacts that are clearly not VIPs (e.g., salespeople, recruiters reaching out cold, mass contacts).
```

**Batch Classification Prompt:**

```
Analyze these contacts and identify VIPs. Return JSON only.

Contacts:
{{CONTACTS_JSON}}

Respond with this exact JSON structure:
{
  "vips": [
    {
      "id": "contact_id_here",
      "confidence": 0.85,
      "reason": "Founder of portfolio company TechCorp, invested Series A",
      "category": "portfolio_founder"
    }
  ],
  "skipped_count": 12,
  "skipped_reason": "Generic contacts without clear VIP indicators"
}

Categories: portfolio_founder, lp, potential_lp, coinvestor, deal_source, advisor, service_provider, personal

Only include contacts with confidence >= 0.6
```

**Contact JSON Format (input to LLM):**

```typescript
interface ContactForClassification {
  id: string;           // Primary key from contacts_merged
  name: string;
  company?: string;
  title?: string;
  email?: string;
  emailDomain?: string; // Extracted for pattern matching
}

// Example batch
const contactsBatch = [
  { id: "abc123", name: "Sarah Chen", company: "Acme Ventures", title: "Partner", emailDomain: "acmevc.com" },
  { id: "def456", name: "John Smith", company: "TechCorp", title: "CEO", emailDomain: "techcorp.io" },
  { id: "ghi789", name: "Bob Wilson", company: "Salesforce", title: "Account Executive", emailDomain: "salesforce.com" },
];
```

**LLM Response Parsing:**

```typescript
interface VIPClassificationResult {
  vips: Array<{
    id: string;
    confidence: number;
    reason: string;
    category: 'portfolio_founder' | 'lp' | 'potential_lp' | 'coinvestor' | 'deal_source' | 'advisor' | 'service_provider' | 'personal';
  }>;
  skippedCount: number;
  skippedReason: string;
}

async function parseClassificationResponse(response: string): Promise<VIPClassificationResult> {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in LLM response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate structure
  if (!Array.isArray(parsed.vips)) {
    throw new Error('Invalid response: vips must be an array');
  }

  return parsed;
}
```

---

### 3.3 — Batch Processing Algorithm

**Token Budget:**

```typescript
const TOKEN_LIMITS = {
  maxInputTokens: 8000,    // Leave room for response
  maxOutputTokens: 2000,
  tokensPerContact: 50,    // Estimate: name + company + title + email
  contactsPerBatch: 150,   // 150 * 50 = 7500 tokens, under limit

  // DeepSeek V3 context: 64K tokens, but we stay conservative
};
```

**Batching Logic:**

```typescript
async function classifyAllContacts(tenantId: string): Promise<void> {
  // 1. Get all unclassified contacts (or all if re-running)
  const contacts = await db.query.contactsMerged.findMany({
    where: eq(contactsMerged.tenantId, tenantId),
    columns: {
      id: true,
      fullName: true,
      company: true,
      title: true,
      email: true,
    },
  });

  // 2. Filter out already-classified if incremental
  const unclassified = contacts.filter(c => !alreadyClassified.has(c.id));

  // 3. Batch into chunks
  const batches = chunk(unclassified, TOKEN_LIMITS.contactsPerBatch);

  console.log(`Classifying ${unclassified.length} contacts in ${batches.length} batches`);

  // 4. Process each batch with rate limiting
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];

    try {
      const result = await classifyBatch(batch);
      await saveClassificationResults(tenantId, result);

      // Rate limit: 1 request per second for DeepSeek
      if (i < batches.length - 1) {
        await sleep(1000);
      }
    } catch (error) {
      console.error(`Batch ${i + 1}/${batches.length} failed:`, error);
      // Continue with next batch; don't fail entire job
    }
  }
}

async function classifyBatch(contacts: ContactForClassification[]): Promise<VIPClassificationResult> {
  const contactsJson = JSON.stringify(
    contacts.map(c => ({
      id: c.id,
      name: c.fullName,
      company: c.company || '',
      title: c.title || '',
      emailDomain: c.email?.split('@')[1] || '',
    })),
    null,
    2
  );

  const prompt = BATCH_CLASSIFICATION_PROMPT.replace('{{CONTACTS_JSON}}', contactsJson);

  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,  // Low temperature for consistency
    max_tokens: TOKEN_LIMITS.maxOutputTokens,
  });

  return parseClassificationResponse(response.choices[0].message.content);
}
```

**Saving Results:**

```typescript
async function saveClassificationResults(
  tenantId: string,
  result: VIPClassificationResult
): Promise<void> {
  for (const vip of result.vips) {
    await db.insert(vipCandidates)
      .values({
        tenantId,
        contactId: vip.id,
        confidence: vip.confidence,
        reason: vip.reason,
        category: vip.category,
        suggestedAt: new Date(),
        approved: null,  // Pending user review
      })
      .onConflictDoUpdate({
        target: [vipCandidates.tenantId, vipCandidates.contactId],
        set: {
          confidence: vip.confidence,
          reason: vip.reason,
          category: vip.category,
          suggestedAt: new Date(),
          // Don't overwrite approved if already set
        },
        where: sql`${vipCandidates.approved} IS NULL`,
      });
  }
}
```

---

### 3.4 — VIP Approval UI

**Dashboard Location:** Main dashboard has a "VIP Suggestions" card when there are pending approvals.

**VIP Approval Page (`/dashboard/vips/pending`):**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  VIP Suggestions                                         [Bulk Actions ▾]│
│  23 contacts suggested • 15 pending review                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ ☐  Sarah Chen                                              [···]  │ │
│  │     Partner @ Acme Ventures                                        │ │
│  │     📊 95% confidence • Co-investor                                │ │
│  │     💬 "Partner at VC firm, likely co-investor or LP"              │ │
│  │                                                                     │ │
│  │     [✓ Approve]  [✗ Reject]  [Skip for now]                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ ☐  John Smith                                              [···]  │ │
│  │     CEO @ TechCorp                                                 │ │
│  │     📊 92% confidence • Portfolio Founder                          │ │
│  │     💬 "CEO of TechCorp, appears to be a portfolio company"        │ │
│  │                                                                     │ │
│  │     [✓ Approve]  [✗ Reject]  [Skip for now]                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ ☐  Mike Johnson                                            [···]  │ │
│  │     Advisor @ StartupX                                             │ │
│  │     📊 72% confidence • Advisor                                    │ │
│  │     💬 "Board advisor, may be valuable for introductions"          │ │
│  │                                                                     │ │
│  │     [✓ Approve]  [✗ Reject]  [Skip for now]                        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  [← Previous]  Page 1 of 5  [Next →]                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Bulk Actions:**

- "Approve All High Confidence (>90%)" — One click to approve obvious VIPs
- "Reject All Low Confidence (<65%)" — Clear out marginal suggestions
- "Approve Selected" / "Reject Selected" — After checkbox selection

**Mobile-Optimized Cards:**

```
┌───────────────────────────────┐
│  Sarah Chen                   │
│  Partner @ Acme Ventures      │
│  95% • Co-investor            │
│                               │
│  "Partner at VC firm..."      │
│                               │
│  [✓ Approve]    [✗ Reject]    │
└───────────────────────────────┘
```

**Keyboard Shortcuts (desktop):**

- `A` — Approve current
- `R` — Reject current
- `S` — Skip (move to next)
- `↑/↓` or `J/K` — Navigate list

**API Endpoints:**

```typescript
// GET /api/vip-candidates?status=pending&page=1&limit=20
// Response: { candidates: VIPCandidate[], total: number, page: number }

// PATCH /api/vip-candidates/:id
// Body: { approved: true | false }
// Response: { success: true, vipCreated: boolean }

// POST /api/vip-candidates/bulk
// Body: { ids: string[], action: 'approve' | 'reject' }
// Response: { processed: number, vipsCreated: number }
```

**Approval Flow:**

```typescript
async function approveVIPCandidate(tenantId: string, candidateId: string): Promise<void> {
  // 1. Update candidate status
  const [candidate] = await db.update(vipCandidates)
    .set({
      approved: true,
      reviewedAt: new Date()
    })
    .where(and(
      eq(vipCandidates.id, candidateId),
      eq(vipCandidates.tenantId, tenantId),
    ))
    .returning();

  // 2. Add to VIP list
  await db.insert(vipList)
    .values({
      tenantId,
      contactId: candidate.contactId,
      category: candidate.category,
      addedAt: new Date(),
      addedBy: 'user_approval',
    })
    .onConflictDoNothing();  // Idempotent
}
```

---

### 3.5 — Schedule & Re-classification

**When classifier runs:**

| Trigger | Frequency | Scope |
|---------|-----------|-------|
| Initial setup | Once | All contacts |
| New contacts synced | After each sync | Only new contacts |
| Manual trigger | On-demand | Selected contacts or all |
| Weekly refresh | Sundays 3 AM | All contacts (re-evaluate) |

**Re-classification Logic:**

```typescript
// On weekly refresh, re-evaluate everyone but don't demote existing VIPs
async function weeklyReclassify(tenantId: string): Promise<void> {
  // Get all contacts
  const contacts = await getAllContacts(tenantId);

  // Run classifier
  const results = await classifyAllContacts(contacts);

  // For new suggestions: add to vip_candidates
  // For existing VIPs: update confidence but don't remove
  // For rejected candidates: update confidence (might promote if company/title changed)
}
```

**Acceptance Criteria (VIP Classifier):**

- DeepSeek processes all contacts in batches of 150
- Each VIP suggestion has confidence score and human-readable reason
- Approval UI works on mobile and desktop with keyboard shortcuts
- Bulk approve/reject for efficiency with 200+ VIPs
- Approved VIPs immediately appear in `vip_list`
- Rejected candidates don't reappear unless re-classified with higher confidence
- Classification job completes within 5 minutes for 1000 contacts
- Rate limits respected (1 req/sec for DeepSeek)

---

## Part 4 — Main Loop Spec (Daily Chief-of-Staff)

**Goal:** Every morning at 7 AM (per tenant timezone), check all VIPs for job changes and exciting news. Generate personalized message drafts and deliver via daily email digest.

**Trigger:** pg-boss cron schedule at 7:00 AM in tenant's configured timezone.

---

### 4.1 — Main Loop Algorithm

```typescript
async function runChiefOfStaffLoop(tenantId: string): Promise<AutomationRunResult> {
  const run = await createAutomationRun(tenantId, 'chief-of-staff-loop');

  try {
    // Step 1: Load VIPs with contact data
    const vips = await loadVIPsWithContacts(tenantId);
    run.vipsConsidered = vips.length;

    if (vips.length === 0) {
      return await completeRun(run, 'success', { message: 'No VIPs to process' });
    }

    // Step 2: Check for job changes (enrichment)
    const jobChanges = await detectJobChanges(tenantId, vips);

    // Step 3: Fetch news for VIP companies
    const newsResults = await fetchNewsForVIPs(tenantId, vips);

    // Step 4: Apply hype filter
    const excitingNews = applyHypeFilter(newsResults);

    // Step 5: Combine triggers
    const vipsWithTriggers = combineTriggersForVIPs(vips, jobChanges, excitingNews);

    // Step 6: Filter out already-contacted
    const vipsToContact = await filterAlreadyContacted(tenantId, vipsWithTriggers);

    if (vipsToContact.length === 0) {
      return await completeRun(run, 'success', { message: 'No new signals' });
    }

    // Step 7: Generate drafts
    const drafts = await generateDraftsForVIPs(vipsToContact);
    run.draftsCreated = drafts.length;

    // Step 8: Send daily digest email
    await sendDailyDigestEmail(tenantId, drafts);

    // Step 9: Log outreach
    await logOutreachForDrafts(tenantId, drafts);

    run.skippedNoSignal = vips.length - vipsToContact.length;
    return await completeRun(run, 'success');

  } catch (error) {
    return await completeRun(run, 'failed', { error: error.message });
  }
}
```

---

### 4.2 — Job Change Detection

**How it works:**

1. For each VIP with a LinkedIn URL, call Proxycurl to get current profile
2. Compare current company/title with stored `contacts_snapshot`
3. Flag as "job change" if different

```typescript
interface JobChangeResult {
  contactId: string;
  changeType: 'new_company' | 'new_title' | 'promoted' | 'left_company';
  previousCompany?: string;
  previousTitle?: string;
  currentCompany: string;
  currentTitle: string;
  detectedAt: Date;
}

async function detectJobChanges(
  tenantId: string,
  vips: VIPWithContact[]
): Promise<Map<string, JobChangeResult>> {
  const changes = new Map<string, JobChangeResult>();

  // Only check VIPs with LinkedIn URLs
  const vipsWithLinkedIn = vips.filter(v => v.contact.linkedinUrl);

  // Batch enrichment (respect rate limits)
  for (const vip of vipsWithLinkedIn) {
    try {
      // Skip if enriched recently (within 7 days)
      if (vip.contact.lastEnrichedAt &&
          daysSince(vip.contact.lastEnrichedAt) < 7) {
        continue;
      }

      const enriched = await enrichLinkedInProfile(vip.contact.linkedinUrl);

      // Compare with stored data
      const companyChanged = enriched.company !== vip.contact.company;
      const titleChanged = enriched.title !== vip.contact.title;

      if (companyChanged || titleChanged) {
        changes.set(vip.contactId, {
          contactId: vip.contactId,
          changeType: determineChangeType(vip.contact, enriched),
          previousCompany: vip.contact.company,
          previousTitle: vip.contact.title,
          currentCompany: enriched.company,
          currentTitle: enriched.title,
          detectedAt: new Date(),
        });

        // Update contact snapshot
        await updateContactSnapshot(vip.contactId, enriched);
      }

      // Rate limit: max 1 request per second
      await sleep(1000);

    } catch (error) {
      // Log but continue with other VIPs
      console.error(`Enrichment failed for ${vip.contact.fullName}:`, error);
    }
  }

  return changes;
}

function determineChangeType(old: Contact, current: EnrichedProfile): JobChangeResult['changeType'] {
  if (old.company !== current.company) {
    if (!current.company) return 'left_company';
    return 'new_company';
  }
  if (old.title !== current.title) {
    // Simple heuristic: if new title contains "Senior", "Head", "VP", "Director", "Chief" and old doesn't
    const promotionKeywords = ['senior', 'head', 'vp', 'vice president', 'director', 'chief', 'lead'];
    const isPromotion = promotionKeywords.some(k =>
      current.title?.toLowerCase().includes(k) &&
      !old.title?.toLowerCase().includes(k)
    );
    return isPromotion ? 'promoted' : 'new_title';
  }
  return 'new_title';  // Fallback
}
```

---

### 4.3 — News Fetching

**Sources (in order of preference):**

1. **Google RSS** — Free, search `site:techcrunch.com OR site:bloomberg.com "{company name}"`
2. **Bing News API** — Fallback, $3/1000 queries

```typescript
interface NewsItem {
  id: string;           // Hash of URL for deduplication
  headline: string;
  url: string;
  source: string;       // "TechCrunch", "Bloomberg", etc.
  publishedAt: Date;
  snippet: string;      // First 200 chars of article
  company: string;      // Which VIP's company this relates to
  category?: NewsCategory;
}

type NewsCategory =
  | 'funding'           // Raised money
  | 'acquisition'       // Acquired or was acquired
  | 'ipo'              // IPO filing or launch
  | 'product_launch'    // Major product announcement
  | 'partnership'       // Strategic partnership
  | 'executive_hire'    // C-suite hire
  | 'layoffs'          // Layoffs (supportive outreach)
  | 'media_mention'     // Press coverage, podcast, interview
  | 'award'            // Industry award or recognition
  | 'other';

async function fetchNewsForVIPs(
  tenantId: string,
  vips: VIPWithContact[]
): Promise<Map<string, NewsItem[]>> {
  const newsMap = new Map<string, NewsItem[]>();

  // Get unique companies
  const companies = [...new Set(vips.map(v => v.contact.company).filter(Boolean))];

  for (const company of companies) {
    try {
      // Try Google RSS first
      let news = await searchGoogleRSS(company);

      // Fallback to Bing if no results
      if (news.length === 0) {
        news = await searchBingNews(company);
      }

      // Filter to last 7 days
      const recentNews = news.filter(n =>
        daysSince(n.publishedAt) <= 7
      );

      if (recentNews.length > 0) {
        newsMap.set(company, recentNews);
      }

      // Rate limit between companies
      await sleep(500);

    } catch (error) {
      console.error(`News fetch failed for ${company}:`, error);
    }
  }

  return newsMap;
}
```

---

### 4.4 — Hype Filter (What Qualifies as "Exciting")

**Purpose:** Only create drafts for news that warrants reaching out. Avoid "just checking in" spam.

```typescript
interface HypeFilterConfig {
  // News categories that always pass
  alwaysExciting: NewsCategory[];

  // Keywords that indicate excitement
  excitingKeywords: string[];

  // Keywords that indicate negative news (supportive outreach)
  supportiveKeywords: string[];

  // Minimum article age (avoid duplicates from multiple sources)
  minAgeHours: number;

  // Maximum article age
  maxAgeDays: number;
}

const DEFAULT_HYPE_CONFIG: HypeFilterConfig = {
  alwaysExciting: [
    'funding',
    'acquisition',
    'ipo',
    'product_launch',
    'executive_hire',
  ],

  excitingKeywords: [
    'raises', 'raised', 'funding', 'series a', 'series b', 'series c', 'series d',
    'acquired', 'acquires', 'acquisition', 'merger',
    'ipo', 'goes public', 'public offering',
    'launches', 'launched', 'announces', 'unveiled',
    'partnership', 'partners with',
    'expands', 'expansion', 'opens',
    'milestone', 'record', 'breakthrough',
    'award', 'recognized', 'named',
  ],

  supportiveKeywords: [
    'layoffs', 'laid off', 'downsizing', 'restructuring',
    'lawsuit', 'sued', 'legal',
    'investigation', 'probe',
    'breach', 'hack', 'security incident',
    'steps down', 'resigns', 'departure',
  ],

  minAgeHours: 2,    // Avoid breaking news that might be corrected
  maxAgeDays: 7,     // Only recent news
};

function applyHypeFilter(
  newsMap: Map<string, NewsItem[]>,
  config = DEFAULT_HYPE_CONFIG
): Map<string, NewsItem[]> {
  const filtered = new Map<string, NewsItem[]>();

  for (const [company, newsItems] of newsMap) {
    const exciting = newsItems.filter(item => {
      // Check age bounds
      const ageHours = hoursSince(item.publishedAt);
      if (ageHours < config.minAgeHours || ageHours > config.maxAgeDays * 24) {
        return false;
      }

      // Check category
      if (item.category && config.alwaysExciting.includes(item.category)) {
        return true;
      }

      // Check keywords in headline + snippet
      const text = `${item.headline} ${item.snippet}`.toLowerCase();

      const hasExcitingKeyword = config.excitingKeywords.some(k => text.includes(k));
      const hasSupportiveKeyword = config.supportiveKeywords.some(k => text.includes(k));

      return hasExcitingKeyword || hasSupportiveKeyword;
    });

    if (exciting.length > 0) {
      // Take top 3 per company (avoid overwhelming)
      filtered.set(company, exciting.slice(0, 3));
    }
  }

  return filtered;
}
```

**Categorization with DeepSeek (optional enhancement):**

```typescript
// If category not detected from keywords, ask DeepSeek
async function categorizeNewsWithLLM(item: NewsItem): Promise<NewsCategory> {
  const prompt = `Categorize this news headline into one category:
Headline: "${item.headline}"
Snippet: "${item.snippet}"

Categories:
- funding (company raised money)
- acquisition (company acquired or was acquired)
- ipo (IPO related)
- product_launch (new product or service)
- partnership (strategic partnership)
- executive_hire (C-suite or VP hire)
- layoffs (layoffs or restructuring)
- media_mention (general press coverage)
- award (recognition or award)
- other

Respond with just the category name, nothing else.`;

  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 20,
    temperature: 0,
  });

  return response.choices[0].message.content.trim() as NewsCategory;
}
```

---

### 4.5 — Draft Generation Prompts

**System Prompt:**

```
You are a personal assistant helping a venture capitalist maintain relationships with important contacts. Your job is to draft short, warm, personal messages that the VC can send via text/iMessage.

Guidelines:
- Keep messages to 2-3 sentences max
- Be warm and genuine, not salesy or formal
- Reference the specific news/event naturally
- Don't include the news URL in the message (it will be provided separately)
- Use casual language appropriate for text messaging
- If it's negative news (layoffs, etc.), be supportive and empathetic
- End with something that invites a response but isn't demanding

The VC will copy-paste your draft directly, so make it ready to send.
```

**Draft Prompts by Trigger Type:**

```typescript
function buildDraftPrompt(
  contact: Contact,
  trigger: VIPTrigger
): string {
  const contactInfo = `
Contact: ${contact.fullName}
Company: ${contact.company || 'Unknown'}
Title: ${contact.title || 'Unknown'}
Relationship: ${contact.category || 'professional contact'}
`;

  switch (trigger.type) {
    case 'new_company':
      return `${contactInfo}
Event: ${contact.fullName} just joined ${trigger.currentCompany} as ${trigger.currentTitle} (previously at ${trigger.previousCompany})

Draft a congratulatory message about their new role.`;

    case 'promoted':
      return `${contactInfo}
Event: ${contact.fullName} was promoted to ${trigger.currentTitle} at ${contact.company}

Draft a congratulatory message about their promotion.`;

    case 'funding':
      return `${contactInfo}
Event: ${contact.company} just raised funding
News: "${trigger.newsHeadline}"

Draft a congratulatory message about the funding round.`;

    case 'acquisition':
      return `${contactInfo}
Event: ${contact.company} acquisition news
News: "${trigger.newsHeadline}"

Draft a message acknowledging this big milestone.`;

    case 'product_launch':
      return `${contactInfo}
Event: ${contact.company} launched something new
News: "${trigger.newsHeadline}"

Draft an enthusiastic message about the launch.`;

    case 'layoffs':
      return `${contactInfo}
Event: ${contact.company} had layoffs/restructuring
News: "${trigger.newsHeadline}"

Draft a supportive, empathetic message checking in on them. Don't mention layoffs directly unless they were personally affected.`;

    case 'media_mention':
      return `${contactInfo}
Event: ${contact.company} or ${contact.fullName} was mentioned in press
News: "${trigger.newsHeadline}"

Draft a brief message acknowledging the coverage.`;

    default:
      return `${contactInfo}
Event: News about their company
News: "${trigger.newsHeadline}"

Draft a relevant, warm message referencing this news.`;
  }
}
```

**Example Drafts Generated:**

| Trigger | Draft |
|---------|-------|
| New job | "Hey Sarah! Just saw you joined Acme Ventures - congrats! That's a huge move. Would love to hear how you're settling in when you have a moment." |
| Funding | "John! Congrats on the Series B - huge milestone for TechCorp. Really exciting to see the momentum. Let me know if there's anything I can help with as you scale." |
| Promotion | "Mike! Just saw you made Partner - well deserved. Congrats! We should grab coffee to celebrate when you're free." |
| Layoffs | "Hey Lisa, thinking of you with everything going on at [Company]. Let me know if there's anything I can do to help or if you just want to chat." |

---

### 4.6 — Already-Contacted Filter

**Prevent duplicate outreach:**

```typescript
async function filterAlreadyContacted(
  tenantId: string,
  vipsWithTriggers: VIPWithTrigger[]
): Promise<VIPWithTrigger[]> {
  const filtered: VIPWithTrigger[] = [];

  for (const vip of vipsWithTriggers) {
    // Check if we've contacted about this specific news item
    if (vip.trigger.newsItemId) {
      const existing = await db.query.outreachLog.findFirst({
        where: and(
          eq(outreachLog.tenantId, tenantId),
          eq(outreachLog.contactId, vip.contactId),
          eq(outreachLog.newsItemId, vip.trigger.newsItemId),
        ),
      });

      if (existing) {
        continue;  // Skip - already contacted about this news
      }
    }

    // Check if we've contacted this person in last 14 days (anti-spam)
    const recentOutreach = await db.query.outreachLog.findFirst({
      where: and(
        eq(outreachLog.tenantId, tenantId),
        eq(outreachLog.contactId, vip.contactId),
        gt(outreachLog.draftSentAt, daysAgo(14)),
      ),
    });

    if (recentOutreach) {
      continue;  // Skip - contacted too recently
    }

    filtered.push(vip);
  }

  return filtered;
}
```

**Configurable Cooldown:**

```typescript
interface OutreachConfig {
  // Minimum days between contacts (per VIP)
  cooldownDays: number;  // Default: 14

  // Maximum drafts per VIP per month
  maxMonthlyPerVip: number;  // Default: 3

  // Maximum total drafts per day (across all VIPs)
  maxDailyDrafts: number;  // Default: 10
}
```

---

### 4.7 — Run Logging

```typescript
interface AutomationRun {
  id: string;
  tenantId: string;
  workflowName: 'chief-of-staff-loop' | 'vip-classifier' | 'contacts-sync';
  startedAt: Date;
  finishedAt?: Date;
  status: 'running' | 'success' | 'partial' | 'failed';
  vipsConsidered: number;
  draftsCreated: number;
  skippedNoSignal: number;
  errorSummary?: string;
}

// Logged per draft
interface OutreachLogEntry {
  id: string;
  tenantId: string;
  contactId: string;
  newsItemId?: string;
  triggerType: string;
  draftText: string;
  draftSentAt: Date;
  deliveryMethod: 'email_digest';
}
```

**Acceptance Criteria (Main Loop):**

- Runs daily at 7 AM per tenant timezone (not twice daily—updated per spec)
- Job changes detected via Proxycurl with 7-day cache
- News fetched from Google RSS with Bing fallback
- Hype filter excludes mundane news; passes funding, acquisitions, launches, layoffs
- Drafts are warm/personal, 2-3 sentences, ready to copy-paste
- No duplicate outreach for same news item
- 14-day cooldown between contacts to same VIP
- Run logs show VIPs considered, drafts created, skipped count
- Entire loop completes in <5 minutes for 200 VIPs

---

## Part 5 — External APIs & Cost Controls

**Goal:** Integrate with external services for enrichment, news, and LLM while controlling costs and respecting rate limits.

---

### 5.1 — Proxycurl (LinkedIn Enrichment)

**Purpose:** Fetch current job info from LinkedIn profiles to detect job changes.

**API Endpoint:**

```typescript
// Person Profile API
// GET https://nubela.co/proxycurl/api/v2/linkedin

const PROXYCURL_API = 'https://nubela.co/proxycurl/api/v2/linkedin';

interface ProxycurlRequest {
  url: string;  // LinkedIn profile URL
  skills?: 'skip';  // Skip to reduce cost
  inferred_salary?: 'skip';
  personal_email?: 'skip';
  personal_contact_number?: 'skip';
  twitter_profile_id?: 'skip';
  facebook_profile_id?: 'skip';
  github_profile_id?: 'skip';
  extra?: 'skip';
}

interface ProxycurlResponse {
  public_identifier: string;
  first_name: string;
  last_name: string;
  full_name: string;
  headline: string;
  summary: string;
  country: string;
  city: string;
  profile_pic_url: string;
  occupation: string;  // Current job title + company
  experiences: Array<{
    starts_at: { day: number; month: number; year: number };
    ends_at: { day: number; month: number; year: number } | null;
    company: string;
    company_linkedin_profile_url: string;
    title: string;
    description: string;
    location: string;
  }>;
}

async function enrichLinkedInProfile(linkedinUrl: string): Promise<EnrichedProfile> {
  const response = await fetch(`${PROXYCURL_API}?url=${encodeURIComponent(linkedinUrl)}`, {
    headers: {
      'Authorization': `Bearer ${process.env.PROXYCURL_API_KEY}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('LinkedIn profile not found');
    }
    if (response.status === 429) {
      throw new Error('Rate limited - retry later');
    }
    throw new Error(`Proxycurl API error: ${response.status}`);
  }

  const data: ProxycurlResponse = await response.json();

  // Extract current position (first experience with no end date)
  const currentJob = data.experiences?.find(exp => exp.ends_at === null);

  return {
    fullName: data.full_name,
    headline: data.headline,
    company: currentJob?.company || extractCompanyFromHeadline(data.headline),
    title: currentJob?.title || extractTitleFromHeadline(data.headline),
    location: `${data.city}, ${data.country}`,
    profilePicUrl: data.profile_pic_url,
    linkedinUrl,
  };
}
```

**Pricing & Cost Control:**

| Plan | Price | Credits/month | Cost per lookup |
|------|-------|---------------|-----------------|
| Pay-as-you-go | $0.00/mo | 0 | $0.01/credit |
| Starter | $29/mo | 500 | $0.058 |
| Growth | $69/mo | 1500 | $0.046 |

**Cost Estimates (200 VIPs):**

```typescript
// Enrichment strategy: check each VIP once per week (7-day cache)
const ENRICHMENT_CONFIG = {
  cacheValidityDays: 7,
  maxEnrichmentsPerDay: 50,  // 200 VIPs / 7 days ≈ 29/day, buffer to 50
  maxEnrichmentsPerRun: 50,  // Single run limit

  // Cost estimate
  // 200 VIPs × 4 weeks/month = ~115 lookups/month (with caching)
  // At $0.01/lookup = $1.15/month per tenant
  // At 3 tenants = ~$3.50/month total
};
```

**Rate Limit Handling:**

```typescript
class ProxycurlRateLimiter {
  private requestTimes: number[] = [];
  private readonly maxPerMinute = 30;  // Proxycurl limit

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old timestamps
    this.requestTimes = this.requestTimes.filter(t => t > oneMinuteAgo);

    if (this.requestTimes.length >= this.maxPerMinute) {
      // Wait until oldest request expires
      const waitTime = this.requestTimes[0] - oneMinuteAgo + 100;
      await sleep(waitTime);
    }

    this.requestTimes.push(now);
  }
}
```

---

### 5.2 — Google RSS (News - Primary)

**Purpose:** Free news search using Google's RSS feed.

**How It Works:**

```typescript
// Google News RSS URL format
// https://news.google.com/rss/search?q={query}&hl=en-US&gl=US&ceid=US:en

const GOOGLE_NEWS_RSS = 'https://news.google.com/rss/search';

interface GoogleNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  description: string;
}

async function searchGoogleRSS(companyName: string): Promise<NewsItem[]> {
  // Build search query - focus on business news sites
  const sites = [
    'techcrunch.com',
    'bloomberg.com',
    'reuters.com',
    'wsj.com',
    'forbes.com',
    'businessinsider.com',
    'theinformation.com',
    'axios.com',
  ];

  const siteQuery = sites.map(s => `site:${s}`).join(' OR ');
  const query = `"${companyName}" (${siteQuery})`;

  const url = new URL(GOOGLE_NEWS_RSS);
  url.searchParams.set('q', query);
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('gl', 'US');
  url.searchParams.set('ceid', 'US:en');

  const response = await fetch(url.toString());
  const xml = await response.text();

  // Parse RSS XML
  const items = parseRSSItems(xml);

  return items.map(item => ({
    id: hashString(item.link),
    headline: cleanTitle(item.title),
    url: item.link,
    source: item.source,
    publishedAt: new Date(item.pubDate),
    snippet: stripHtml(item.description).slice(0, 200),
    company: companyName,
  }));
}

function parseRSSItems(xml: string): GoogleNewsItem[] {
  // Use fast-xml-parser or similar
  const parser = new XMLParser();
  const result = parser.parse(xml);

  const channel = result?.rss?.channel;
  if (!channel?.item) return [];

  const items = Array.isArray(channel.item) ? channel.item : [channel.item];

  return items.map(item => ({
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    source: item.source?.['#text'] || item.source || 'Unknown',
    description: item.description || '',
  }));
}
```

**Limitations:**

- No official rate limit, but don't abuse (max 10 req/min recommended)
- Results may be cached/delayed
- Limited to ~100 results per query
- No structured data (must parse headlines)

---

### 5.3 — Bing News API (Fallback)

**Purpose:** Fallback when Google RSS returns no results. More reliable but paid.

**API Endpoint:**

```typescript
// Bing News Search API v7
// GET https://api.bing.microsoft.com/v7.0/news/search

const BING_NEWS_API = 'https://api.bing.microsoft.com/v7.0/news/search';

interface BingNewsRequest {
  q: string;           // Search query
  count?: number;      // Results per page (max 100)
  offset?: number;     // Pagination
  mkt?: string;        // Market (e.g., 'en-US')
  freshness?: 'Day' | 'Week' | 'Month';
  sortBy?: 'Date' | 'Relevance';
}

interface BingNewsResponse {
  value: Array<{
    name: string;         // Headline
    url: string;
    description: string;
    datePublished: string;
    provider: Array<{ name: string }>;
    category?: string;
  }>;
  totalEstimatedMatches: number;
}

async function searchBingNews(companyName: string): Promise<NewsItem[]> {
  const url = new URL(BING_NEWS_API);
  url.searchParams.set('q', `"${companyName}"`);
  url.searchParams.set('count', '20');
  url.searchParams.set('mkt', 'en-US');
  url.searchParams.set('freshness', 'Week');
  url.searchParams.set('sortBy', 'Date');

  const response = await fetch(url.toString(), {
    headers: {
      'Ocp-Apim-Subscription-Key': process.env.BING_NEWS_API_KEY!,
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Bing rate limited');
    }
    throw new Error(`Bing API error: ${response.status}`);
  }

  const data: BingNewsResponse = await response.json();

  return data.value.map(item => ({
    id: hashString(item.url),
    headline: item.name,
    url: item.url,
    source: item.provider[0]?.name || 'Unknown',
    publishedAt: new Date(item.datePublished),
    snippet: item.description.slice(0, 200),
    company: companyName,
  }));
}
```

**Pricing:**

| Tier | Price | Queries/month | Cost per query |
|------|-------|---------------|----------------|
| S1 | $3/1k | 1,000 | $0.003 |
| S2 | $8/1k | 10,000 | $0.0008 |

**Cost Estimates:**

```typescript
// Fallback strategy: only use Bing when Google returns 0 results
// Estimate: ~20% of searches need Bing fallback
// 200 VIPs × 50 unique companies × 30 days / 7 (weekly news check) ≈ 215 searches/month
// 20% fallback = ~43 Bing queries/month
// At $0.003/query = $0.13/month per tenant
```

---

### 5.4 — DeepSeek API (LLM)

**Purpose:** VIP classification and draft generation.

**API Endpoint:**

```typescript
// DeepSeek Chat API (OpenAI-compatible)
// POST https://api.deepseek.com/chat/completions

import OpenAI from 'openai';

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// VIP Classification call
async function classifyContacts(contacts: Contact[]): Promise<ClassificationResult> {
  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',  // DeepSeek V3
    messages: [
      { role: 'system', content: VIP_CLASSIFIER_SYSTEM_PROMPT },
      { role: 'user', content: formatContactsForClassification(contacts) },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  });

  return parseClassificationResponse(response.choices[0].message.content);
}

// Draft Generation call
async function generateDraft(trigger: VIPTrigger): Promise<string> {
  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: DRAFT_SYSTEM_PROMPT },
      { role: 'user', content: buildDraftPrompt(trigger) },
    ],
    temperature: 0.7,  // More creative for drafts
    max_tokens: 200,
  });

  return response.choices[0].message.content.trim();
}
```

**Pricing (as of 2024):**

| Model | Input tokens | Output tokens |
|-------|-------------|---------------|
| deepseek-chat (V3) | $0.14 / 1M | $0.28 / 1M |

**Cost Estimates:**

```typescript
const DEEPSEEK_COSTS = {
  // VIP Classification (weekly, ~1000 contacts)
  classification: {
    inputTokens: 50000,    // ~50 tokens/contact × 1000 contacts
    outputTokens: 10000,   // ~10 tokens/VIP × 500 suggested VIPs
    costPerRun: 0.014,     // $0.014 per classification run
    monthlyRuns: 4,        // Weekly
    monthlyCost: 0.056,    // $0.056/month per tenant
  },

  // Draft Generation (daily, ~5 drafts/day average)
  drafts: {
    inputTokensPerDraft: 200,
    outputTokensPerDraft: 100,
    draftsPerDay: 5,
    daysPerMonth: 30,
    monthlyCost: 0.018,    // $0.018/month per tenant
  },

  // Total: ~$0.08/month per tenant for LLM
};
```

---

### 5.5 — Resend (Email Delivery)

**Purpose:** Send daily digest emails.

**API:**

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

interface DigestEmail {
  to: string;
  tenantName: string;
  drafts: DraftWithContact[];
  generatedAt: Date;
}

async function sendDailyDigest(email: DigestEmail): Promise<void> {
  const html = renderDigestEmail(email);

  await resend.emails.send({
    from: 'Chief of Staff <digest@yourdomain.com>',
    to: email.to,
    subject: `${email.drafts.length} VIP updates for ${formatDate(email.generatedAt)}`,
    html,
    tags: [
      { name: 'tenant', value: email.tenantName },
      { name: 'type', value: 'daily_digest' },
    ],
  });
}
```

**Pricing:**

| Tier | Emails/month | Price |
|------|-------------|-------|
| Free | 100 | $0 |
| Pro | 50,000 | $20/mo |

**Cost Estimate:**

```typescript
// 1 digest/day per tenant = 30 emails/month
// 3 tenants = 90 emails/month = FREE tier
// 10 tenants = 300 emails/month = still FREE
```

---

### 5.6 — Cost Summary & Budgets

**Monthly Cost Per Tenant (200 VIPs):**

| Service | Usage | Cost |
|---------|-------|------|
| Proxycurl | ~115 lookups | $1.15 |
| Bing News | ~45 queries | $0.14 |
| DeepSeek | Classification + drafts | $0.08 |
| Resend | 30 emails | $0.00 |
| **Total** | | **$1.37/mo** |

**Platform Total (10 tenants):**

| Service | Cost |
|---------|------|
| Proxycurl | $11.50 |
| Bing News | $1.40 |
| DeepSeek | $0.80 |
| Resend (Pro) | $20.00 |
| **Total** | **~$34/mo** |

**Budget Alerts (implement in dashboard):**

```typescript
interface CostBudget {
  proxycurl: {
    monthlyLimit: 500,    // $5 max
    alertThreshold: 0.8,  // Alert at 80%
  },
  bingNews: {
    monthlyLimit: 500,    // $1.50 max
    alertThreshold: 0.8,
  },
  deepseek: {
    monthlyLimit: 1000000, // 1M tokens
    alertThreshold: 0.8,
  },
}
```

---

### 5.7 — Rate Limit Handling

**Unified Rate Limiter:**

```typescript
class APIRateLimiter {
  private limiters = new Map<string, TokenBucket>();

  constructor() {
    // Configure per-API limits
    this.limiters.set('proxycurl', new TokenBucket(30, 60));    // 30/min
    this.limiters.set('bing', new TokenBucket(10, 1));          // 10/sec
    this.limiters.set('deepseek', new TokenBucket(60, 60));     // 60/min
    this.limiters.set('google_rss', new TokenBucket(10, 60));   // 10/min (self-imposed)
  }

  async acquire(api: string): Promise<void> {
    const limiter = this.limiters.get(api);
    if (limiter) {
      await limiter.acquire();
    }
  }
}

// Usage
const rateLimiter = new APIRateLimiter();

async function enrichWithRateLimit(url: string) {
  await rateLimiter.acquire('proxycurl');
  return enrichLinkedInProfile(url);
}
```

**Retry Strategy:**

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
  } = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000 }
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < options.maxRetries) {
        const delay = Math.min(
          options.baseDelayMs * Math.pow(2, attempt),
          options.maxDelayMs
        );

        // Add jitter
        const jitter = Math.random() * delay * 0.1;
        await sleep(delay + jitter);
      }
    }
  }

  throw lastError;
}
```

**Acceptance Criteria (APIs & Cost Controls):**

- Proxycurl enrichment respects 30/min rate limit
- 7-day cache on enrichment results to minimize API calls
- Google RSS used as primary news source (free)
- Bing fallback only when Google returns 0 results
- DeepSeek API key works with OpenAI-compatible client
- Monthly cost stays under $2/tenant for typical usage
- Rate limit errors trigger exponential backoff retry
- Cost tracking visible in admin dashboard

---

## Part 6 — Daily Email Digest Delivery

**Goal:** Deliver VIP updates as a single daily email digest at 7 AM. User can quickly scan drafts and copy-paste to text/iMessage.

---

### 6.1 — Digest Format

**Email Structure:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│  🗓️  Your VIP Updates for March 15, 2024                               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                                                          │
│  3 contacts with updates today                                          │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  👤 SARAH CHEN                                                      │ │
│  │  Partner @ Acme Ventures                                            │ │
│  │  ──────────────────────────────────────────────────────────────── │ │
│  │                                                                      │ │
│  │  📰 News: "Acme Ventures closes $200M Fund III"                     │ │
│  │      TechCrunch · 2 hours ago                                       │ │
│  │                                                                      │ │
│  │  ✉️  DRAFT MESSAGE:                                                 │ │
│  │  ┌─────────────────────────────────────────────────────────────┐   │ │
│  │  │  Sarah! Congrats on Fund III closing - that's huge! Would   │   │ │
│  │  │  love to catch up and hear about your thesis for the new    │   │ │
│  │  │  fund when you have a moment.                                │   │ │
│  │  └─────────────────────────────────────────────────────────────┘   │ │
│  │                                                                      │ │
│  │  [📋 Copy Draft]    [📰 Read Article]                               │ │
│  │                                                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │  👤 JOHN SMITH                                                      │ │
│  │  CEO @ TechCorp                                                     │ │
│  │  ──────────────────────────────────────────────────────────────── │ │
│  │                                                                      │ │
│  │  🚀 Job Change: Now CEO at TechCorp (was CTO at StartupX)          │ │
│  │                                                                      │ │
│  │  ✉️  DRAFT MESSAGE:                                                 │ │
│  │  ┌─────────────────────────────────────────────────────────────┐   │ │
│  │  │  John! Just saw you made the move to TechCorp as CEO -      │   │ │
│  │  │  congrats! That's a big step. Let me know how I can help    │   │ │
│  │  │  as you get ramped up.                                       │   │ │
│  │  └─────────────────────────────────────────────────────────────┘   │ │
│  │                                                                      │ │
│  │  [📋 Copy Draft]                                                    │ │
│  │                                                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ──────────────────────────────────────────────────────────────────────│
│  💡 Tip: Copy a draft and paste into iMessage or WhatsApp to send.    │
│                                                                          │
│  [View Dashboard →]                                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 6.2 — HTML Email Template

```typescript
// src/emails/daily-digest.tsx
import {
  Html, Head, Body, Container, Section, Row, Column,
  Heading, Text, Button, Hr, Link, Preview,
} from '@react-email/components';

interface DailyDigestProps {
  userName: string;
  date: string;
  drafts: Array<{
    contact: {
      name: string;
      company?: string;
      title?: string;
    };
    triggerType: 'news' | 'job_change';
    newsHeadline?: string;
    newsSource?: string;
    newsUrl?: string;
    jobChangeDetails?: {
      previousCompany: string;
      previousTitle: string;
      currentCompany: string;
      currentTitle: string;
    };
    draftText: string;
  }>;
  dashboardUrl: string;
}

export function DailyDigestEmail({ userName, date, drafts, dashboardUrl }: DailyDigestProps) {
  return (
    <Html>
      <Head />
      <Preview>{drafts.length} VIP updates for {date}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Heading style={styles.title}>
              Your VIP Updates for {date}
            </Heading>
            <Text style={styles.subtitle}>
              {drafts.length} contact{drafts.length !== 1 ? 's' : ''} with updates today
            </Text>
          </Section>

          {/* Drafts */}
          {drafts.map((draft, index) => (
            <Section key={index} style={styles.card}>
              {/* Contact Info */}
              <Text style={styles.contactName}>
                {draft.contact.name}
              </Text>
              <Text style={styles.contactMeta}>
                {draft.contact.title} @ {draft.contact.company}
              </Text>

              <Hr style={styles.divider} />

              {/* Trigger Info */}
              {draft.triggerType === 'news' && (
                <Section>
                  <Text style={styles.triggerLabel}>📰 News:</Text>
                  <Text style={styles.newsHeadline}>"{draft.newsHeadline}"</Text>
                  <Text style={styles.newsMeta}>
                    {draft.newsSource} · <Link href={draft.newsUrl}>Read article</Link>
                  </Text>
                </Section>
              )}

              {draft.triggerType === 'job_change' && (
                <Section>
                  <Text style={styles.triggerLabel}>🚀 Job Change:</Text>
                  <Text style={styles.jobChange}>
                    Now {draft.jobChangeDetails.currentTitle} at {draft.jobChangeDetails.currentCompany}
                    {' '}(was {draft.jobChangeDetails.previousTitle} at {draft.jobChangeDetails.previousCompany})
                  </Text>
                </Section>
              )}

              {/* Draft Message */}
              <Text style={styles.draftLabel}>✉️ DRAFT MESSAGE:</Text>
              <Section style={styles.draftBox}>
                <Text style={styles.draftText}>{draft.draftText}</Text>
              </Section>

              {/* Copy Button - Note: actual copy requires JS, so this links to dashboard */}
              <Button href={`${dashboardUrl}/drafts/${index}?copy=true`} style={styles.copyButton}>
                📋 Copy Draft
              </Button>
            </Section>
          ))}

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.tip}>
              💡 Tip: Copy a draft and paste into iMessage or WhatsApp to send.
            </Text>
            <Button href={dashboardUrl} style={styles.dashboardButton}>
              View Dashboard →
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#f4f4f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '8px 8px 0 0',
    borderBottom: '1px solid #e4e4e7',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#18181b',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#71717a',
    margin: '0',
  },
  card: {
    backgroundColor: '#ffffff',
    padding: '20px 24px',
    borderBottom: '1px solid #e4e4e7',
  },
  contactName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#18181b',
    margin: '0 0 4px 0',
  },
  contactMeta: {
    fontSize: '14px',
    color: '#71717a',
    margin: '0',
  },
  divider: {
    borderColor: '#e4e4e7',
    margin: '16px 0',
  },
  triggerLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#71717a',
    textTransform: 'uppercase' as const,
    margin: '0 0 8px 0',
  },
  newsHeadline: {
    fontSize: '14px',
    color: '#18181b',
    fontStyle: 'italic',
    margin: '0 0 4px 0',
  },
  newsMeta: {
    fontSize: '12px',
    color: '#71717a',
    margin: '0 0 16px 0',
  },
  jobChange: {
    fontSize: '14px',
    color: '#18181b',
    margin: '0 0 16px 0',
  },
  draftLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#71717a',
    textTransform: 'uppercase' as const,
    margin: '0 0 8px 0',
  },
  draftBox: {
    backgroundColor: '#f4f4f5',
    borderRadius: '6px',
    padding: '12px 16px',
    borderLeft: '3px solid #3b82f6',
    margin: '0 0 16px 0',
  },
  draftText: {
    fontSize: '14px',
    color: '#18181b',
    lineHeight: '1.5',
    margin: '0',
    whiteSpace: 'pre-wrap' as const,
  },
  copyButton: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    padding: '10px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    textDecoration: 'none',
    display: 'inline-block',
  },
  footer: {
    backgroundColor: '#ffffff',
    padding: '24px',
    borderRadius: '0 0 8px 8px',
    textAlign: 'center' as const,
  },
  tip: {
    fontSize: '13px',
    color: '#71717a',
    margin: '0 0 16px 0',
  },
  dashboardButton: {
    backgroundColor: '#18181b',
    color: '#ffffff',
    padding: '12px 24px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    textDecoration: 'none',
    display: 'inline-block',
  },
};
```

---

### 6.3 — Resend Integration

```typescript
// src/lib/email.ts
import { Resend } from 'resend';
import { render } from '@react-email/render';
import { DailyDigestEmail } from '@/emails/daily-digest';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendDigestParams {
  tenantId: string;
  userEmail: string;
  userName: string;
  drafts: DraftWithContact[];
}

export async function sendDailyDigest(params: SendDigestParams): Promise<void> {
  const { tenantId, userEmail, userName, drafts } = params;

  // Don't send if no drafts
  if (drafts.length === 0) {
    console.log(`No drafts for tenant ${tenantId}, skipping digest`);
    return;
  }

  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const dashboardUrl = `${process.env.NEXTAUTH_URL}/dashboard`;

  // Render email
  const html = render(
    DailyDigestEmail({
      userName,
      date,
      drafts: drafts.map(d => ({
        contact: {
          name: d.contact.fullName,
          company: d.contact.company,
          title: d.contact.title,
        },
        triggerType: d.trigger.type === 'job_change' ? 'job_change' : 'news',
        newsHeadline: d.trigger.newsHeadline,
        newsSource: d.trigger.newsSource,
        newsUrl: d.trigger.newsUrl,
        jobChangeDetails: d.trigger.jobChangeDetails,
        draftText: d.draftText,
      })),
      dashboardUrl,
    })
  );

  // Send via Resend
  const { data, error } = await resend.emails.send({
    from: 'Chief of Staff <digest@chiefofstaff.app>',  // Use your verified domain
    to: userEmail,
    subject: `${drafts.length} VIP update${drafts.length !== 1 ? 's' : ''} for ${date}`,
    html,
    tags: [
      { name: 'tenant_id', value: tenantId },
      { name: 'email_type', value: 'daily_digest' },
      { name: 'draft_count', value: String(drafts.length) },
    ],
  });

  if (error) {
    console.error('Failed to send digest email:', error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  console.log(`Digest sent to ${userEmail}: ${data.id}`);
}
```

---

### 6.4 — Scheduling Per Timezone

```typescript
// src/jobs/digestScheduler.ts
import PgBoss from 'pg-boss';

// Schedule digest for each tenant at their local 7 AM
async function scheduleDigestJobs(boss: PgBoss): Promise<void> {
  const tenants = await db.query.tenants.findMany({
    where: and(
      eq(tenants.status, 'active'),
      isNotNull(tenants.setupCompletedAt),
    ),
    columns: {
      id: true,
      timezone: true,
    },
  });

  for (const tenant of tenants) {
    const timezone = tenant.timezone || 'America/New_York';

    // Schedule at 7:00 AM in tenant's timezone
    await boss.schedule(
      `digest-${tenant.id}`,  // Unique schedule name per tenant
      '0 7 * * *',            // 7:00 AM
      {
        tenantId: tenant.id,
        jobName: 'send-daily-digest',
      },
      {
        tz: timezone,
        singletonKey: `digest-${tenant.id}`,  // Prevent duplicates
      }
    );
  }
}

// Job handler
async function handleDigestJob(job: Job<{ tenantId: string }>) {
  const { tenantId } = job.data;

  // Run the chief-of-staff loop to generate drafts
  const runResult = await runChiefOfStaffLoop(tenantId);

  if (runResult.draftsCreated === 0) {
    console.log(`No drafts for tenant ${tenantId}, no digest sent`);
    return;
  }

  // Get tenant admins to send digest to
  const admins = await db.query.users.findMany({
    where: and(
      eq(users.tenantId, tenantId),
      inArray(users.role, ['admin', 'platform_admin']),
    ),
  });

  // Send digest to each admin
  for (const admin of admins) {
    await sendDailyDigest({
      tenantId,
      userEmail: admin.email,
      userName: admin.name || 'there',
      drafts: runResult.drafts,
    });
  }
}
```

---

### 6.5 — Mobile-Optimized Design

**Key Mobile Considerations:**

```typescript
const mobileStyles = {
  // Cards stack vertically
  container: {
    padding: '12px',  // Less padding on mobile
  },

  // Larger touch targets
  copyButton: {
    padding: '14px 20px',  // Bigger for thumb taps
    minWidth: '120px',
    fontSize: '16px',
  },

  // Readable text size
  draftText: {
    fontSize: '16px',  // Slightly larger for mobile
    lineHeight: '1.6',
  },

  // Full-width buttons on mobile
  '@media (max-width: 480px)': {
    copyButton: {
      width: '100%',
      textAlign: 'center',
    },
  },
};
```

**Responsive Email Meta:**

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
```

---

### 6.6 — Copy Flow (Dashboard Fallback)

Since email clients don't support JavaScript for copy-to-clipboard, the "Copy Draft" button links to the dashboard:

```typescript
// src/app/dashboard/drafts/[id]/page.tsx
export default async function DraftCopyPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { copy?: string };
}) {
  const draft = await getDraftById(params.id);

  // Auto-copy if ?copy=true (uses client-side JS)
  const shouldAutoCopy = searchParams.copy === 'true';

  return (
    <div className="max-w-xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">
        Message for {draft.contact.fullName}
      </h1>

      <DraftCard draft={draft} autoCopy={shouldAutoCopy} />

      <div className="mt-6 text-sm text-gray-500">
        Copied! Paste into iMessage, WhatsApp, or your preferred messenger.
      </div>
    </div>
  );
}

// Client component for copy functionality
'use client';
function DraftCard({ draft, autoCopy }: { draft: Draft; autoCopy: boolean }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (autoCopy) {
      copyToClipboard(draft.draftText);
      setCopied(true);
    }
  }, [autoCopy, draft.draftText]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draft.draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-blue-500">
      <p className="whitespace-pre-wrap">{draft.draftText}</p>
      <button
        onClick={handleCopy}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md"
      >
        {copied ? '✓ Copied!' : '📋 Copy Draft'}
      </button>
    </div>
  );
}
```

**Acceptance Criteria (Email Delivery):**

- Daily digest email sent at 7 AM in tenant's timezone
- Email renders correctly in Gmail, Apple Mail, Outlook (web & desktop)
- Mobile-responsive: readable on iPhone/Android without horizontal scroll
- Each VIP card shows trigger (news or job change), draft text, and copy action
- "Copy Draft" button links to dashboard for actual clipboard copy
- Empty days (no drafts) = no email sent (silent)
- Email delivery tracked with Resend tags for analytics
- Unsubscribe link in footer (required for deliverability)

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
  - **Contact Source (choose one or more):**
    - **iCloud / CardDAV:** Apple ID + app-specific password (with inline help + link to Apple's docs); "Test connection" hits CardDAV read-only.
    - **Google Contacts:** OAuth flow with `contacts.readonly` scope.
    - **CSV Upload:** Drag-and-drop file upload with column mapping preview.
  - **Enrichment (optional but recommended):** Proxycurl API key for LinkedIn job change detection.
  - **News:** Platform-provided (Google RSS + Bing News fallback). No user configuration needed.
  - **LLM:** Platform-provided (DeepSeek). No user configuration needed.
  - **Email Delivery:** Email address for daily digest (defaults to login email). Verify via confirmation link.
  - **Schedule:** Timezone selection (auto-detected) + digest time (defaults to 7 AM).
4. **Post-setup dashboard** — See **Part 10** (not shown during first-time wizard).
5. **Rotate / revoke** — Per-integration "Disconnect" and "Replace key" without deleting the whole account.

**Credential acceptance workflow (UX rules):**

- **OAuth-first:** Where the vendor supports it (Google Contacts), use **OAuth with minimal scopes**; show exact scopes in the UI before consent.
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
| **Application**        | Use cases: `RunCardDavSync`, `RunGoogleContactsSync`, `RunVipClassification`, `RunChiefOfStaffLoop`, `SaveIntegrationCredentials`, `TestProxycurlConnection`. Orchestrates domain + ports. |
| **Ports (interfaces)** | `ICardDavClient`, `IGoogleContactsClient`, `IEnrichmentClient`, `INewsClient`, `ILLMClient`, `IEmailClient`, `ISecretStore`, `IJobQueue` (pg-boss).                        |
| **Adapters**           | Implementations: HTTP clients for Proxycurl/DeepSeek; CardDAV adapter; Google Contacts OAuth; Resend email; Postgres repositories; **libsodium envelope encryption** for secrets. |
| **API**                | REST for the web app: auth, wizard steps, health; **no secrets in responses**.                                                                                              |


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

## Part 9 — Trust, Security Copy & Marketing

**Goal:** Reduce credential anxiety through transparency. Users fear "someone on the other end"—explain exactly what we do and don't do with their data.

---

### 9.1 — Security Page (`/security`)

```markdown
# Security & Privacy

Your contacts are your most valuable professional asset. Here's how we protect them.

---

## How Your Data is Protected

### Encryption at Rest
All data is encrypted using AES-256 encryption. Your integration credentials (iCloud password, API keys) are additionally encrypted with envelope encryption before storage. Even if our database were compromised, your secrets would remain unreadable.

### Encryption in Transit
All connections use TLS 1.3. We enforce HTTPS everywhere—there is no unencrypted fallback.

### OAuth When Possible
For Google Contacts, we use OAuth 2.0 with minimal scopes. We request only read access to your contacts—we cannot modify or delete them. Your Google password is never shared with us.

### Minimal Data Retention
- **Contact data:** Refreshed on each sync, deleted when you disconnect the source
- **Draft messages:** Stored for 30 days, then automatically deleted
- **Automation logs:** Kept for 90 days for debugging, then purged
- **Credentials:** Deleted immediately when you disconnect an integration

---

## What We Never Do

❌ **No human sees your credentials.** Your iCloud app-specific password and API keys are encrypted the moment they hit our server. Our team cannot view them, even for debugging.

❌ **No selling your data.** Your contacts and their information are never sold, shared with advertisers, or monetized in any way.

❌ **No AI training on your data.** We use DeepSeek to generate message drafts. Your contacts are sent to their API for processing but are NOT used to train their models. We contractually prohibit this.

❌ **No automatic sending.** We generate draft messages for you to review and send yourself. The app will never send a message on your behalf without you manually copying and pasting it.

❌ **No surprise access requests.** We'll never ask for your credentials via email, chat, or phone. The only place to enter credentials is the secure settings page within the app.

---

## Where Your Data Lives

| Data Type | Location | Provider |
|-----------|----------|----------|
| Application database | US (Virginia) | Self-hosted on Proxmox |
| Encrypted backups | US | Backblaze B2 |
| LLM processing | China/Singapore | DeepSeek |
| Email delivery | US | Resend |
| Contact enrichment | US | Proxycurl |

---

## Third-Party Services (Subprocessors)

We use the following services to operate the platform:

| Service | Purpose | Privacy Policy |
|---------|---------|----------------|
| DeepSeek | AI for VIP classification and draft generation | [Privacy Policy](https://deepseek.com/privacy) |
| Proxycurl | LinkedIn profile enrichment | [Privacy Policy](https://proxycurl.com/privacy) |
| Resend | Sending daily digest emails | [Privacy Policy](https://resend.com/legal/privacy-policy) |
| Cloudflare | CDN, DDoS protection | [Privacy Policy](https://www.cloudflare.com/privacypolicy/) |
| Sentry | Error monitoring | [Privacy Policy](https://sentry.io/privacy/) |

---

## Your Rights

**Export your data:** Download all your contacts and automation history at any time from Settings → Export Data.

**Delete your account:** Request complete account deletion from Settings → Delete Account. All your data is permanently removed within 48 hours.

**Revoke access:** Disconnect any integration instantly. Your credentials are deleted immediately, and we lose access to that service.

---

## Questions?

Email us at security@chiefofstaff.app. We respond within 24 hours.
```

---

### 9.2 — Integration Modal Copy

**iCloud Contacts Setup:**

```typescript
const iCloudModalCopy = {
  title: "Connect iCloud Contacts",
  description: `
    We'll sync your iCloud contacts so you can identify VIPs and track their news.
  `,
  whyWeNeedThis: `
    **Why we need this:** To read your contacts and identify which ones are VIPs worth tracking.
  `,
  whatWeWontDo: `
    **What we won't do:** We can only READ your contacts. We cannot add, modify, or delete contacts in iCloud. Your contacts are never shared or sold.
  `,
  securityNote: `
    Your app-specific password is encrypted before storage and cannot be viewed by our team.
  `,
  helpLink: "How to create an app-specific password →",
};
```

**Google Contacts OAuth:**

```typescript
const googleContactsModalCopy = {
  title: "Connect Google Contacts",
  preAuth: `
    You'll be redirected to Google to authorize access to your contacts.
  `,
  scopeExplanation: `
    **What we're requesting:**
    • Read-only access to your contacts
    • Your email address (for login)

    **What we're NOT requesting:**
    • Write access to your contacts
    • Access to Gmail, Calendar, or Drive
    • Any other Google services
  `,
  postAuth: `
    ✓ Connected! We'll sync your contacts shortly.
  `,
};
```

**API Key Entry (Proxycurl, etc.):**

```typescript
const apiKeyModalCopy = {
  proxycurl: {
    title: "Connect Proxycurl",
    description: "Proxycurl helps us detect when your VIPs change jobs by checking their LinkedIn profiles.",
    whyWeNeedThis: "This enables job change detection so you can congratulate contacts on new roles.",
    whatWeWontDo: "We only use your API key to look up contacts you've marked as VIPs—typically a few dozen profiles per week.",
    costNote: "Cost: ~$0.01 per profile lookup. With 200 VIPs, expect ~$1-2/month.",
  },
  deepseek: {
    title: "AI Provider (DeepSeek)",
    description: "DeepSeek AI powers VIP classification and message drafts.",
    note: "Platform-provided—you don't need your own key. Your data is not used for AI training.",
  },
};
```

---

### 9.3 — Why Not a Human Assistant?

**Copy for marketing page or FAQ:**

```markdown
## Why use Chief of Staff instead of a human assistant?

### Speed & Scale
A human assistant can track maybe 50 relationships effectively. Chief of Staff monitors 200+ VIPs daily and never misses a news story or job change.

### Consistency
No sick days, no vacation, no forgetting. Every morning at 7 AM, you get updates on everyone who matters.

### Privacy
A human assistant reads your contacts, your messages, your drafts. Chief of Staff processes data through encrypted systems with no human access to your information.

### Cost
A part-time EA costs $2,000-4,000/month. Chief of Staff is a fraction of that for unlimited contacts.

### No Hallway Conversations
Your assistant might mention "did you see John left TechCorp?" in passing—and forget to follow up. Chief of Staff creates a draft so you take action immediately.

---

## But I like my human assistant!

Great—use both. Chief of Staff handles the monitoring and draft generation. Your human assistant handles scheduling, travel, and the tasks that actually need a human.
```

---

### 9.4 — In-App Consent Copy

**Setup Wizard Consent (shown once during setup):**

```typescript
const consentCopy = {
  checkbox: "I authorize Chief of Staff to:",
  points: [
    "Store my integration credentials encrypted for my workspace",
    "Sync and store my contacts for automation purposes",
    "Process my VIPs through AI to identify news and job changes",
    "Send me a daily email digest with message drafts",
  ],
  footer: "You can disconnect any integration or delete your account at any time.",
  link: "Read our full Privacy Policy and Terms of Service",
};
```

**Integration-Specific Consent:**

```typescript
const integrationConsent = {
  icloud: {
    before: "By connecting, you agree to let Chief of Staff read your iCloud contacts.",
    after: "✓ Connected. Your contacts will sync in the background.",
  },
  google: {
    before: "You'll authorize read-only access to your Google Contacts.",
    after: "✓ Connected. We have read-only access to your contacts.",
  },
};
```

---

### 9.5 — Error Messages with Trust Context

**Credential Errors:**

```typescript
const errorMessages = {
  icloud_401: {
    title: "Authentication Failed",
    message: "Your iCloud credentials couldn't connect. This usually means the app-specific password expired or was revoked.",
    action: "Generate a new app-specific password",
    reassurance: "Your old password has been securely deleted from our system.",
  },
  google_revoked: {
    title: "Google Access Revoked",
    message: "Your Google Contacts access was revoked. This can happen if you changed your Google password or removed the app from your Google account.",
    action: "Reconnect Google Contacts",
    reassurance: "We'll request the same read-only permissions as before.",
  },
  rate_limited: {
    title: "Temporarily Unavailable",
    message: "We're checking VIPs faster than our data provider allows. Everything will catch up within the hour.",
    reassurance: "Your data is safe. No action needed.",
  },
};
```

---

### 9.6 — Trust Badges (Optional UI Elements)

```typescript
const trustBadges = [
  {
    icon: "🔒",
    label: "End-to-End Encrypted",
    tooltip: "Your credentials are encrypted before leaving your browser",
  },
  {
    icon: "👁️‍🗨️",
    label: "No Human Access",
    tooltip: "Our team cannot view your contacts or credentials",
  },
  {
    icon: "🚫",
    label: "No Auto-Send",
    tooltip: "We draft messages—you decide when to send",
  },
  {
    icon: "🗑️",
    label: "Delete Anytime",
    tooltip: "One click to remove all your data permanently",
  },
];
```

**Acceptance Criteria (Trust & Security):**

- `/security` page is publicly accessible (no login required)
- Security page explains encryption, data handling, subprocessors
- Every integration modal has "why we need this" + "what we won't do"
- Consent checkbox required before setup can complete
- Error messages include reassurance about data safety
- No marketing fluff—specific, verifiable claims only
- Trust badges appear subtly throughout the app (footer, settings)

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
2. **Credential wizard** — OAuth flow (Google Contacts); iCloud CardDAV setup; Proxycurl API key
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
4. **Enrichment client** — Proxycurl API wrapper
5. **News client** — Google RSS parser + Bing News API wrapper
6. **LLM client** — DeepSeek draft generation
7. **chief-of-staff job** — Enrich + news + draft + email; daily at 7 AM
8. **Cron scheduler** — Register all tenant jobs with pg-boss

### Phase 6: Delivery & Polish (Parts 5–6)

1. **Email digest** — Daily HTML email via Resend with draft cards
2. **Copy flow** — Dashboard page for one-click copy from email links
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
- After Phase 5: Automations actually run; drafts appear in email digest
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
  integrationType: 'carddav' | 'google_contacts' | 'enrichment' | 'email';
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
import { sendDailyDigest } from '@/lib/email';

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

        // Collect draft for batch email
        draftsToSend.push({
          contact: vip.contact,
          draft,
          trigger: jobChanged ? 'job_change' : 'news',
          newsUrl: excitingNews[0]?.url,
          newsHeadline: excitingNews[0]?.headline,
        });

        // Log outreach
        await db.insert(outreachLog).values({
          tenantId,
          carddavUid: vip.carddavUid,
          newsItemId: excitingNews[0]?.id,
          draftSentAt: new Date(),
          deliveryMethod: 'email_digest',
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
│   ├── carddav.ts         # iCloud CardDAV client
│   ├── google-contacts.ts # Google People API client
│   ├── enrichment.ts      # Proxycurl LinkedIn enrichment
│   ├── news.ts            # Google RSS + Bing News
│   ├── llm.ts             # DeepSeek client
│   ├── email.ts           # Resend email delivery
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


**External services (locked-in choices from decisions table):**


| Service    | Choice                            | Notes                                    |
| ---------- | --------------------------------- | ---------------------------------------- |
| Enrichment | **Proxycurl**                     | LinkedIn profile scraping, ~$0.01/lookup |
| News       | **Google RSS** + **Bing News**    | Google RSS primary (free), Bing fallback |
| LLM        | **DeepSeek V3** (`deepseek-chat`) | User has existing API key                |
| Email      | **Resend**                        | Daily digest delivery                    |


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


**Integration types:** `carddav`, `google_contacts`, `enrichment`, `email_delivery`

Note: `news` and `llm` are platform-provided (DeepSeek, Google RSS/Bing) and don't require user configuration.

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
| `INTEGRATION_ERROR`   | 502         | External API (Proxycurl, DeepSeek) failed |
| `JOB_FAILED`          | 500         | Background job execution failed         |


**Logging strategy:**


| Level   | When                                        | Example                                    |
| ------- | ------------------------------------------- | ------------------------------------------ |
| `error` | Unhandled exceptions, external API failures | "Proxycurl API returned 500"               |
| `warn`  | Expected failures, rate limits, retries     | "Rate limited by Bing News, backing off"   |
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

**Alerting (Sentry + email):**


| Condition                                               | Alert                    |
| ------------------------------------------------------- | ------------------------ |
| Error rate > 10% in 5 minutes                           | Email to platform admin  |
| Any `INTEGRATION_ERROR` for specific tenant 3x in a row | Email to platform admin  |
| Background job fails after all retries                  | Sentry alert             |
| Disk/memory > 90%                                       | Infrastructure alert     |


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
- **Dry run flag:** `DRY_RUN=true` env var skips email delivery, logs instead

**Test data strategy:**

- **Seed script:** `pnpm db:seed` creates test tenant, users, sample contacts, mock runs
- **Fixtures:** JSON files for mock API responses (Proxycurl, Bing News, DeepSeek)
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
| DeepSeek API issues       | Contact DeepSeek support; their API is OpenAI-compatible     |
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

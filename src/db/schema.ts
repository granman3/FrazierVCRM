import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  real,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// TENANTS & USERS
// ============================================================================

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, suspended, deleted
  timezone: varchar("timezone", { length: 50 }).default("America/New_York"),
  setupCompletedAt: timestamp("setup_completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    image: text("image"),
    role: varchar("role", { length: 20 }).notNull().default("member"), // member, admin, platform_admin
    emailVerified: timestamp("email_verified"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    tenantIdx: index("users_tenant_idx").on(table.tenantId),
  })
);

// ============================================================================
// NEXTAUTH TABLES
// ============================================================================

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (table) => ({
    providerProviderAccountIdIdx: uniqueIndex(
      "accounts_provider_provider_account_id_idx"
    ).on(table.provider, table.providerAccountId),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionToken: varchar("session_token", { length: 255 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires").notNull(),
  },
  (table) => ({
    sessionTokenIdx: uniqueIndex("sessions_session_token_idx").on(
      table.sessionToken
    ),
  })
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  })
);

// ============================================================================
// INVITES
// ============================================================================

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    type: varchar("type", { length: 20 }).notNull(), // tenant (join existing) or platform (create new)
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    email: varchar("email", { length: 255 }), // Optional: pre-fill email
    role: varchar("role", { length: 20 }).default("member"), // Role to assign when accepted
    createdBy: uuid("created_by").references(() => users.id),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    acceptedBy: uuid("accepted_by").references(() => users.id),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex("invites_token_hash_idx").on(table.tokenHash),
  })
);

// ============================================================================
// CONTACTS
// ============================================================================

export const contactsSnapshot = pgTable(
  "contacts_snapshot",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 20 }).notNull(), // icloud, google, csv
    sourceId: varchar("source_id", { length: 255 }).notNull(), // UID from source
    fullName: varchar("full_name", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }),
    title: varchar("title", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    linkedinUrl: text("linkedin_url"),
    rawData: jsonb("raw_data"), // Original vCard or API response
    lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
    lastEnrichedAt: timestamp("last_enriched_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: uniqueIndex("contacts_source_idx").on(
      table.tenantId,
      table.sourceType,
      table.sourceId
    ),
    emailIdx: index("contacts_email_idx").on(table.tenantId, table.email),
    linkedinIdx: index("contacts_linkedin_idx").on(table.tenantId, table.linkedinUrl),
    nameCompanyIdx: index("contacts_name_company_idx").on(
      table.tenantId,
      table.fullName,
      table.company
    ),
  })
);

export const contactsMerged = pgTable(
  "contacts_merged",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    primarySnapshotId: uuid("primary_snapshot_id")
      .notNull()
      .references(() => contactsSnapshot.id),
    linkedSnapshotIds: jsonb("linked_snapshot_ids").$type<string[]>().default([]),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }),
    title: varchar("title", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    linkedinUrl: text("linkedin_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("contacts_merged_tenant_idx").on(table.tenantId),
  })
);

// ============================================================================
// VIP CLASSIFICATION
// ============================================================================

export const vipCandidates = pgTable(
  "vip_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contactsMerged.id, { onDelete: "cascade" }),
    confidence: real("confidence").notNull(),
    reason: text("reason").notNull(),
    category: varchar("category", { length: 30 }).notNull(), // portfolio_founder, lp, coinvestor, etc.
    suggestedAt: timestamp("suggested_at").defaultNow().notNull(),
    approved: boolean("approved"), // null = pending, true = approved, false = rejected
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantContactIdx: uniqueIndex("vip_candidates_tenant_contact_idx").on(
      table.tenantId,
      table.contactId
    ),
    pendingIdx: index("vip_candidates_pending_idx").on(table.tenantId, table.approved),
  })
);

export const vipList = pgTable(
  "vip_list",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contactsMerged.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 30 }),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    addedBy: varchar("added_by", { length: 50 }), // 'user_approval', 'manual', etc.
    removedAt: timestamp("removed_at"),
  },
  (table) => ({
    tenantContactIdx: uniqueIndex("vip_list_tenant_contact_idx").on(
      table.tenantId,
      table.contactId
    ),
    activeIdx: index("vip_list_active_idx").on(table.tenantId, table.removedAt),
  })
);

// ============================================================================
// NEWS & OUTREACH
// ============================================================================

export const newsItems = pgTable(
  "news_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    urlHash: varchar("url_hash", { length: 64 }).notNull(),
    headline: text("headline").notNull(),
    url: text("url").notNull(),
    source: varchar("source", { length: 100 }),
    company: varchar("company", { length: 255 }),
    category: varchar("category", { length: 30 }), // funding, acquisition, product_launch, etc.
    snippet: text("snippet"),
    publishedAt: timestamp("published_at"),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (table) => ({
    urlHashIdx: uniqueIndex("news_items_url_hash_idx").on(
      table.tenantId,
      table.urlHash
    ),
    companyIdx: index("news_items_company_idx").on(table.tenantId, table.company),
  })
);

export const outreachLog = pgTable(
  "outreach_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contactsMerged.id),
    newsItemId: uuid("news_item_id").references(() => newsItems.id),
    triggerType: varchar("trigger_type", { length: 30 }).notNull(), // job_change, news, manual
    draftText: text("draft_text").notNull(),
    draftSentAt: timestamp("draft_sent_at").defaultNow().notNull(),
    deliveryMethod: varchar("delivery_method", { length: 30 }).notNull(), // email_digest
    deliveryPayload: jsonb("delivery_payload"), // email message ID, etc.
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    contactIdx: index("outreach_log_contact_idx").on(table.tenantId, table.contactId),
    newsItemIdx: index("outreach_log_news_idx").on(table.tenantId, table.newsItemId),
    sentAtIdx: index("outreach_log_sent_at_idx").on(table.tenantId, table.draftSentAt),
  })
);

// ============================================================================
// INTEGRATION SECRETS
// ============================================================================

export const integrationSecrets = pgTable(
  "integration_secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    integrationType: varchar("integration_type", { length: 30 }).notNull(), // carddav, google_contacts, proxycurl
    encryptedPayload: text("encrypted_payload").notNull(),
    lastTestedAt: timestamp("last_tested_at"),
    testStatus: varchar("test_status", { length: 20 }), // success, failed, pending
    testError: text("test_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    rotatedAt: timestamp("rotated_at"),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => ({
    tenantTypeIdx: uniqueIndex("integration_secrets_tenant_type_idx").on(
      table.tenantId,
      table.integrationType
    ),
  })
);

// ============================================================================
// AUTOMATION RUNS
// ============================================================================

export const automationRuns = pgTable(
  "automation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    workflowName: varchar("workflow_name", { length: 50 }).notNull(), // contacts-sync, vip-classifier, chief-of-staff
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    status: varchar("status", { length: 20 }).notNull().default("running"), // running, success, partial, failed
    vipsConsidered: integer("vips_considered").default(0),
    draftsCreated: integer("drafts_created").default(0),
    skippedNoSignal: integer("skipped_no_signal").default(0),
    errorSummary: text("error_summary"),
    metadata: jsonb("metadata"), // Additional run details
  },
  (table) => ({
    tenantIdx: index("automation_runs_tenant_idx").on(table.tenantId),
    startedAtIdx: index("automation_runs_started_at_idx").on(
      table.tenantId,
      table.startedAt
    ),
  })
);

// ============================================================================
// AUDIT LOG
// ============================================================================

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    userId: uuid("user_id").references(() => users.id),
    action: varchar("action", { length: 50 }).notNull(), // credential_created, credential_rotated, etc.
    targetType: varchar("target_type", { length: 50 }),
    targetId: varchar("target_id", { length: 255 }),
    metadata: jsonb("metadata"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index("audit_log_tenant_idx").on(table.tenantId, table.createdAt),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  invites: many(invites),
  contacts: many(contactsSnapshot),
  contactsMerged: many(contactsMerged),
  vipCandidates: many(vipCandidates),
  vipList: many(vipList),
  newsItems: many(newsItems),
  outreachLog: many(outreachLog),
  integrationSecrets: many(integrationSecrets),
  automationRuns: many(automationRuns),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
  invitesCreated: many(invites),
}));

export const contactsSnapshotRelations = relations(contactsSnapshot, ({ one }) => ({
  tenant: one(tenants, {
    fields: [contactsSnapshot.tenantId],
    references: [tenants.id],
  }),
}));

export const contactsMergedRelations = relations(contactsMerged, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contactsMerged.tenantId],
    references: [tenants.id],
  }),
  primarySnapshot: one(contactsSnapshot, {
    fields: [contactsMerged.primarySnapshotId],
    references: [contactsSnapshot.id],
  }),
  vipCandidate: many(vipCandidates),
  vipEntry: many(vipList),
  outreach: many(outreachLog),
}));

export const vipCandidatesRelations = relations(vipCandidates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [vipCandidates.tenantId],
    references: [tenants.id],
  }),
  contact: one(contactsMerged, {
    fields: [vipCandidates.contactId],
    references: [contactsMerged.id],
  }),
}));

export const vipListRelations = relations(vipList, ({ one }) => ({
  tenant: one(tenants, {
    fields: [vipList.tenantId],
    references: [tenants.id],
  }),
  contact: one(contactsMerged, {
    fields: [vipList.contactId],
    references: [contactsMerged.id],
  }),
}));

export const outreachLogRelations = relations(outreachLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [outreachLog.tenantId],
    references: [tenants.id],
  }),
  contact: one(contactsMerged, {
    fields: [outreachLog.contactId],
    references: [contactsMerged.id],
  }),
  newsItem: one(newsItems, {
    fields: [outreachLog.newsItemId],
    references: [newsItems.id],
  }),
}));

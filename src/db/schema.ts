import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  real,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// USERS
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    image: text("image"),
    role: varchar("role", { length: 20 }).notNull().default("member"),
    emailVerified: timestamp("email_verified"),
    lastLoginAt: timestamp("last_login_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  })
);

// NextAuth tables
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
    providerIdx: uniqueIndex("accounts_provider_idx").on(table.provider, table.providerAccountId),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionToken: varchar("session_token", { length: 255 }).notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires").notNull(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("sessions_token_idx").on(table.sessionToken),
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
// CONTACTS
// ============================================================================

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceType: varchar("source_type", { length: 20 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }),
    title: varchar("title", { length: 255 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 50 }),
    linkedinUrl: text("linkedin_url"),
    crunchbaseUrl: text("crunchbase_url"),
    photoUrl: text("photo_url"),
    rawData: jsonb("raw_data"),
    lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    sourceIdx: uniqueIndex("contacts_source_idx").on(table.sourceType, table.sourceId),
    emailIdx: index("contacts_email_idx").on(table.email),
    nameCompanyIdx: index("contacts_name_company_idx").on(table.fullName, table.company),
  })
);

// ============================================================================
// COMPANIES
// ============================================================================

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    domain: varchar("domain", { length: 255 }),
    crunchbaseUrl: text("crunchbase_url"),
    linkedinUrl: text("linkedin_url"),
    logoUrl: text("logo_url"),
    sector: varchar("sector", { length: 100 }),
    stage: varchar("stage", { length: 50 }),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    headcount: integer("headcount"),
    foundedYear: integer("founded_year"),
    hqLocation: varchar("hq_location", { length: 255 }),
    description: text("description"),
    lastFundingDate: timestamp("last_funding_date"),
    lastFundingAmount: bigint("last_funding_amount", { mode: "number" }),
    totalRaised: bigint("total_raised", { mode: "number" }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex("companies_name_idx").on(table.name),
    statusIdx: index("companies_status_idx").on(table.status),
    sectorIdx: index("companies_sector_idx").on(table.sector),
  })
);

// ============================================================================
// COMPANY EMPLOYEES
// ============================================================================

export const companyEmployees = pgTable(
  "company_employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }),
    department: varchar("department", { length: 100 }),
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    isKeyPerson: boolean("is_key_person").notNull().default(false),
    source: varchar("source", { length: 30 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    companyActiveIdx: index("ce_company_active_idx").on(table.companyId, table.endedAt),
    contactIdx: index("ce_contact_idx").on(table.contactId),
    uniqueEmployment: uniqueIndex("ce_unique_idx").on(table.companyId, table.contactId, table.startedAt),
  })
);

// ============================================================================
// FUNDING ROUNDS
// ============================================================================

export const fundingRounds = pgTable(
  "funding_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    roundType: varchar("round_type", { length: 50 }).notNull(),
    amount: bigint("amount", { mode: "number" }),
    valuation: bigint("valuation", { mode: "number" }),
    date: timestamp("date"),
    leadInvestors: jsonb("lead_investors").$type<string[]>(),
    allInvestors: jsonb("all_investors").$type<string[]>(),
    frazierParticipated: boolean("frazier_participated").notNull().default(false),
    source: varchar("source", { length: 30 }),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("fr_company_idx").on(table.companyId),
    dateIdx: index("fr_date_idx").on(table.date),
  })
);

// ============================================================================
// DEALS (Investment Pipeline)
// ============================================================================

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    dealName: varchar("deal_name", { length: 255 }).notNull(),
    stage: varchar("stage", { length: 50 }).notNull().default("sourced"),
    assignedTo: uuid("assigned_to").references(() => users.id),
    source: varchar("source", { length: 100 }),
    sector: varchar("sector", { length: 100 }),
    checkSize: bigint("check_size", { mode: "number" }),
    valuation: bigint("valuation", { mode: "number" }),
    notes: text("notes"),
    stageUpdatedAt: timestamp("stage_updated_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
    passedAt: timestamp("passed_at"),
    passReason: text("pass_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    stageIdx: index("deals_stage_idx").on(table.stage),
    companyIdx: index("deals_company_idx").on(table.companyId),
    assignedIdx: index("deals_assigned_idx").on(table.assignedTo),
  })
);

// ============================================================================
// INTERACTIONS
// ============================================================================

export const interactions = pgTable(
  "interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").references(() => contacts.id),
    companyId: uuid("company_id").references(() => companies.id),
    userId: uuid("user_id").references(() => users.id),
    type: varchar("type", { length: 30 }).notNull(),
    subject: varchar("subject", { length: 500 }),
    body: text("body"),
    occurredAt: timestamp("occurred_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    contactIdx: index("interactions_contact_idx").on(table.contactId),
    companyIdx: index("interactions_company_idx").on(table.companyId),
    occurredIdx: index("interactions_occurred_idx").on(table.occurredAt),
  })
);

// ============================================================================
// TAGS
// ============================================================================

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    color: varchar("color", { length: 7 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: uniqueIndex("tags_name_idx").on(table.name),
  })
);

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.contactId, table.tagId] }),
  })
);

export const companyTags = pgTable(
  "company_tags",
  {
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.companyId, table.tagId] }),
  })
);

// ============================================================================
// VIPS
// ============================================================================

export const vips = pgTable(
  "vips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
    confidence: real("confidence").notNull(),
    reason: text("reason").notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    autoApproved: boolean("auto_approved").notNull().default(false),
    active: boolean("active").notNull().default(true),
    addedAt: timestamp("added_at").defaultNow().notNull(),
    removedAt: timestamp("removed_at"),
  },
  (table) => ({
    contactIdx: uniqueIndex("vips_contact_idx").on(table.contactId),
    activeIdx: index("vips_active_idx").on(table.active),
  })
);

// ============================================================================
// NEWS
// ============================================================================

export const newsItems = pgTable(
  "news_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    urlHash: varchar("url_hash", { length: 64 }).notNull(),
    headline: text("headline").notNull(),
    url: text("url").notNull(),
    source: varchar("source", { length: 100 }),
    company: varchar("company", { length: 255 }),
    contactId: uuid("contact_id").references(() => contacts.id),
    category: varchar("category", { length: 30 }),
    snippet: text("snippet"),
    publishedAt: timestamp("published_at"),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (table) => ({
    urlHashIdx: uniqueIndex("news_items_url_hash_idx").on(table.urlHash),
    companyIdx: index("news_items_company_idx").on(table.company),
  })
);

// ============================================================================
// OUTREACH LOG
// ============================================================================

export const outreachLog = pgTable(
  "outreach_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contactId: uuid("contact_id").notNull().references(() => contacts.id),
    newsItemId: uuid("news_item_id").references(() => newsItems.id),
    triggerType: varchar("trigger_type", { length: 30 }).notNull(),
    draftText: text("draft_text").notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    contactIdx: index("outreach_log_contact_idx").on(table.contactId),
    sentAtIdx: index("outreach_log_sent_at_idx").on(table.sentAt),
  })
);

// ============================================================================
// PIPELINE RUNS
// ============================================================================

export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    status: varchar("status", { length: 20 }).notNull().default("running"),
    contactsSynced: integer("contacts_synced").default(0),
    vipsProcessed: integer("vips_processed").default(0),
    draftsCreated: integer("drafts_created").default(0),
    errorSummary: text("error_summary"),
  },
  (table) => ({
    startedAtIdx: index("runs_started_at_idx").on(table.startedAt),
  })
);

// ============================================================================
// DEPARTURE ALERTS
// ============================================================================

export const departureAlerts = pgTable(
  "departure_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyEmployeeId: uuid("company_employee_id").notNull().references(() => companyEmployees.id),
    contactId: uuid("contact_id").notNull().references(() => contacts.id),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    previousTitle: varchar("previous_title", { length: 255 }),
    detectedAt: timestamp("detected_at").defaultNow().notNull(),
    acknowledged: boolean("acknowledged").notNull().default(false),
    acknowledgedBy: uuid("acknowledged_by").references(() => users.id),
    acknowledgedAt: timestamp("acknowledged_at"),
  },
  (table) => ({
    unackIdx: index("da_unack_idx").on(table.acknowledged, table.detectedAt),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  deals: many(deals),
  interactions: many(interactions),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  vip: many(vips),
  outreach: many(outreachLog),
  employments: many(companyEmployees),
  interactions: many(interactions),
  tags: many(contactTags),
  newsItems: many(newsItems),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  employees: many(companyEmployees),
  fundingRounds: many(fundingRounds),
  deals: many(deals),
  interactions: many(interactions),
  tags: many(companyTags),
  departureAlerts: many(departureAlerts),
}));

export const companyEmployeesRelations = relations(companyEmployees, ({ one }) => ({
  company: one(companies, { fields: [companyEmployees.companyId], references: [companies.id] }),
  contact: one(contacts, { fields: [companyEmployees.contactId], references: [contacts.id] }),
}));

export const fundingRoundsRelations = relations(fundingRounds, ({ one }) => ({
  company: one(companies, { fields: [fundingRounds.companyId], references: [companies.id] }),
}));

export const dealsRelations = relations(deals, ({ one }) => ({
  company: one(companies, { fields: [deals.companyId], references: [companies.id] }),
  assignee: one(users, { fields: [deals.assignedTo], references: [users.id] }),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  contact: one(contacts, { fields: [interactions.contactId], references: [contacts.id] }),
  company: one(companies, { fields: [interactions.companyId], references: [companies.id] }),
  user: one(users, { fields: [interactions.userId], references: [users.id] }),
}));

export const vipsRelations = relations(vips, ({ one }) => ({
  contact: one(contacts, { fields: [vips.contactId], references: [contacts.id] }),
}));

export const outreachLogRelations = relations(outreachLog, ({ one }) => ({
  contact: one(contacts, { fields: [outreachLog.contactId], references: [contacts.id] }),
  newsItem: one(newsItems, { fields: [outreachLog.newsItemId], references: [newsItems.id] }),
}));

export const newsItemsRelations = relations(newsItems, ({ one }) => ({
  contact: one(contacts, { fields: [newsItems.contactId], references: [contacts.id] }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  contacts: many(contactTags),
  companies: many(companyTags),
}));

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, { fields: [contactTags.contactId], references: [contacts.id] }),
  tag: one(tags, { fields: [contactTags.tagId], references: [tags.id] }),
}));

export const companyTagsRelations = relations(companyTags, ({ one }) => ({
  company: one(companies, { fields: [companyTags.companyId], references: [companies.id] }),
  tag: one(tags, { fields: [companyTags.tagId], references: [tags.id] }),
}));

export const departureAlertsRelations = relations(departureAlerts, ({ one }) => ({
  companyEmployee: one(companyEmployees, { fields: [departureAlerts.companyEmployeeId], references: [companyEmployees.id] }),
  contact: one(contacts, { fields: [departureAlerts.contactId], references: [contacts.id] }),
  company: one(companies, { fields: [departureAlerts.companyId], references: [companies.id] }),
  acknowledgedByUser: one(users, { fields: [departureAlerts.acknowledgedBy], references: [users.id] }),
}));

import {
  pgTable,
  serial,
  text,
  varchar,
  timestamp,
  jsonb,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── USERS ──
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 255 }).unique(),
  email: varchar("email", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }),
  picture: text("picture"),
  isBanned: boolean("is_banned").default(false),
  bannedAt: timestamp("banned_at"),
  banReason: text("ban_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  status: varchar("status", { length: 50 }),
  tier: varchar("tier", { length: 50 }).default("free"),
  trialEnd: timestamp("trial_end"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const githubConnections = pgTable("github_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  githubUsername: varchar("github_username", { length: 255 }),
  accessToken: text("access_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userCredits = pgTable(
  "user_credits",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    balance: integer("balance").default(0).notNull(),
    tier: varchar("tier", { length: 50 }).default("free"),
    monthlyAllowance: integer("monthly_allowance").default(0),
    unlimited: boolean("unlimited").default(false),
    lastRefillAt: timestamp("last_refill_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [index("user_credits_balance_idx").on(table.balance)],
);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    projectId: integer("project_id"),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("credit_tx_user_idx").on(table.userId),
    index("credit_tx_type_idx").on(table.type),
    index("credit_tx_project_idx").on(table.projectId),
  ],
);

export const projects = pgTable(
  "projects",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }),
    description: text("description"),
    techStack: varchar("tech_stack", { length: 255 }).default("react-node"),
    status: varchar("status", { length: 50 }).default("pending"),
    errorMessage: text("error_message"),
    pauseReason: text("pause_reason"),
    generatedFiles: jsonb("generated_files"),
    creditsSpent: integer("credits_spent").default(0),
    creditsReserved: integer("credits_reserved").default(0),
    locale: varchar("locale", { length: 10 }).default("en"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("projects_user_id_idx").on(table.userId),
    index("projects_status_idx").on(table.status),
    index("projects_created_at_idx").on(table.createdAt),
    index("projects_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const agentLogs = pgTable(
  "agent_logs",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
    agent: varchar("agent", { length: 50 }),
    content: text("content"),
    creditsCharged: integer("credits_charged").default(0),
    isComplete: boolean("is_complete").default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("agent_logs_project_idx").on(table.projectId),
    index("agent_logs_agent_idx").on(table.agent),
    index("agent_logs_project_created_idx").on(table.projectId, table.createdAt),
  ],
);

export const cosineImprovements = pgTable(
  "cosine_improvements",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    improvements: jsonb("improvements"),
    prUrl: text("pr_url"),
    status: varchar("status", { length: 50 }).default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("cosine_improvements_project_idx").on(table.projectId),
    index("cosine_improvements_user_idx").on(table.userId),
  ],
);

export const userStrikes = pgTable(
  "user_strikes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    strikeNumber: integer("strike_number").notNull(),
    reason: text("reason").notNull(),
    contentSnapshot: text("content_snapshot"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("user_strikes_user_idx").on(table.userId)],
);

export const moderationFlags = pgTable(
  "moderation_flags",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
    flaggedText: text("flagged_text").notNull(),
    category: varchar("category", { length: 50 }).notNull(),
    autoFlagged: boolean("auto_flagged").default(true),
    adminReviewed: boolean("admin_reviewed").default(false),
    adminAction: varchar("admin_action", { length: 50 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("moderation_flags_user_idx").on(table.userId),
    index("moderation_flags_category_idx").on(table.category),
    index("moderation_flags_reviewed_idx").on(table.adminReviewed),
  ],
);

export const godCodes = pgTable(
  "god_codes",
  {
    id: serial("id").primaryKey(),
    hash: varchar("hash", { length: 64 }).unique(),
    encryptedCode: text("encrypted_code"),
    grantType: varchar("grant_type", { length: 50 }),
    codeHash: varchar("code_hash", { length: 255 }).unique(),
    tier: varchar("tier", { length: 50 }),
    credits: integer("credits").default(0),
    trialDays: integer("trial_days").default(0),
    expiresAt: timestamp("expires_at"),
    isUsed: boolean("is_used").default(false),
    usedByUserId: integer("used_by_user_id").references(() => users.id, { onDelete: "set null" }),
    usedAt: timestamp("used_at"),
    redeemedAt: timestamp("redeemed_at"),
    redeemedByUserId: integer("redeemed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("god_codes_hash_idx").on(table.codeHash),
    index("god_codes_hash_col_idx").on(table.hash),
    index("god_codes_used_idx").on(table.isUsed),
  ],
);

export const smsVerifications = pgTable(
  "sms_verifications",
  {
    id: serial("id").primaryKey(),
    codeId: integer("code_id").references(() => godCodes.id, { onDelete: "cascade" }).notNull(),
    phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
    otpHash: varchar("otp_hash", { length: 255 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    verifiedAt: timestamp("verified_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("sms_verifications_code_idx").on(table.codeId),
    index("sms_verifications_expires_idx").on(table.expiresAt),
  ],
);

export const complianceRecords = pgTable(
  "compliance_records",
  {
    id: serial("id").primaryKey(),
    recordType: varchar("record_type", { length: 50 }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    details: jsonb("details"),
    adminEmail: varchar("admin_email", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("compliance_records_type_idx").on(table.recordType),
    index("compliance_records_user_idx").on(table.userId),
  ],
);

export const userSessions = pgTable(
  "user_sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    ipAddress: varchar("ip_address", { length: 50 }),
    userAgent: text("user_agent"),
    country: varchar("country", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("user_sessions_user_idx").on(table.userId)],
);

export const cosineConnections = pgTable("cosine_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).unique(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const seniorDevTasks = pgTable(
  "senior_dev_tasks",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    request: text("request").notNull(),
    mode: varchar("mode", { length: 20 }).default("collaborative"),
    plan: jsonb("plan"),
    planApproved: boolean("plan_approved").default(false),
    status: varchar("status", { length: 50 }).default("planning"),
    changes: jsonb("changes"),
    validationResult: jsonb("validation_result"),
    summary: text("summary"),
    creditsSpent: integer("credits_spent").default(0),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("senior_dev_tasks_project_idx").on(table.projectId),
    index("senior_dev_tasks_user_idx").on(table.userId),
    index("senior_dev_tasks_status_idx").on(table.status),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  projects: many(projects),
  subscriptions: one(subscriptions),
  githubConnections: one(githubConnections),
  cosineConnections: one(cosineConnections),
  credits: one(userCredits),
  creditTransactions: many(creditTransactions),
  strikes: many(userStrikes),
  moderationFlags: many(moderationFlags),
  godCodeUses: many(godCodes),
  complianceRecords: many(complianceRecords),
  sessions: many(userSessions),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  agentLogs: many(agentLogs),
  cosineImprovements: many(cosineImprovements),
  seniorDevTasks: many(seniorDevTasks),
  creditTransactions: many(creditTransactions),
  moderationFlags: many(moderationFlags),
}));

export const godCodesRelations = relations(godCodes, ({ one }) => ({
  usedByUser: one(users, { fields: [godCodes.usedByUserId], references: [users.id] }),
  redeemedByUser: one(users, { fields: [godCodes.redeemedByUserId], references: [users.id] }),
}));

export const smsVerificationsRelations = relations(smsVerifications, ({ one }) => ({
  godCode: one(godCodes, { fields: [smsVerifications.codeId], references: [godCodes.id] }),
}));

export const moderationFlagsRelations = relations(moderationFlags, ({ one }) => ({
  user: one(users, { fields: [moderationFlags.userId], references: [users.id] }),
  project: one(projects, { fields: [moderationFlags.projectId], references: [projects.id] }),
}));

export const seniorDevTasksRelations = relations(seniorDevTasks, ({ one }) => ({
  project: one(projects, { fields: [seniorDevTasks.projectId], references: [projects.id] }),
  user: one(users, { fields: [seniorDevTasks.userId], references: [users.id] }),
}));

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const buildSnapshots = pgTable(
  "build_snapshots",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    version: integer("version").notNull(),
    label: varchar("label", { length: 255 }),
    files: jsonb("files").notNull(),
    fileCount: integer("file_count").notNull(),
    techStack: varchar("tech_stack", { length: 100 }),
    validationResult: jsonb("validation_result"),
    auditScores: jsonb("audit_scores"),
    costEstimate: jsonb("cost_estimate"),
    isCurrent: boolean("is_current").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("snapshots_project_version_idx").on(table.projectId, table.version),
    index("snapshots_current_idx").on(table.isCurrent),
    index("snapshots_project_idx").on(table.projectId),
  ],
);

export const buildSnapshotsRelations = relations(buildSnapshots, ({ one }) => ({
  project: one(projects, { fields: [buildSnapshots.projectId], references: [projects.id] }),
  user: one(users, { fields: [buildSnapshots.userId], references: [users.id] }),
}));

export const projectMessages = pgTable(
  "project_messages",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("project_messages_project_idx").on(table.projectId),
    index("project_messages_created_idx").on(table.projectId, table.createdAt),
  ],
);

export const buildEvents = pgTable(
  "build_events",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    event: varchar("event", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("build_events_project_idx").on(table.projectId),
    index("build_events_project_id_idx").on(table.projectId, table.id),
  ],
);

export const projectAssets = pgTable(
  "project_assets",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
    filename: varchar("filename", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("project_assets_project_idx").on(table.projectId)],
);

export const userBuildStats = pgTable("user_build_stats", {
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).primaryKey(),
  totalBuilds: integer("total_builds").default(0).notNull(),
  successfulBuilds: integer("successful_builds").default(0).notNull(),
  failedBuilds: integer("failed_builds").default(0).notNull(),
  totalCreditsSpent: integer("total_credits_spent").default(0).notNull(),
  totalDeploys: integer("total_deploys").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

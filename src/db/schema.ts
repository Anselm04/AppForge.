import { pgTable, serial, text, varchar, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 255 }).unique(),
  email: varchar("email", { length: 255 }).unique(),
  name: varchar("name", { length: 255 }),
  picture: text("picture"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).unique(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  status: varchar("status", { length: 50 }), // 'active', 'canceled', 'past_due', etc
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const githubConnections = pgTable("github_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).unique(),
  githubUsername: varchar("github_username", { length: 255 }),
  accessToken: text("access_token"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cosineConnections = pgTable("cosine_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).unique(),
  cosineApiKey: text("cosine_api_key"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }),
  description: text("description"),
  techStack: varchar("tech_stack", { length: 255 }).default("react-node"),
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'running', 'completed', 'failed'
  errorMessage: text("error_message"),
  generatedFiles: jsonb("generated_files"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const agentLogs = pgTable("agent_logs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  agent: varchar("agent", { length: 50 }), // 'Planner', 'Coder', 'Reviewer', 'Cosine'
  content: text("content"),
  isComplete: boolean("is_complete").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cosineImprovements = pgTable("cosine_improvements", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  improvements: jsonb("improvements"), // Array of improvement types: ['bug-fix', 'feature-add', 'optimize', etc]
  prUrl: text("pr_url"),
  status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'in-progress', 'completed', 'failed'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  projects: many(projects),
  subscriptions: one(subscriptions),
  githubConnections: one(githubConnections),
  cosineConnections: one(cosineConnections),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, { fields: [projects.userId], references: [users.id] }),
  agentLogs: many(agentLogs),
  cosineImprovements: many(cosineImprovements),
}));

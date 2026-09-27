import { describe, expect, it } from "vitest";
import {
  databaseCoderInstruction,
  databasePersistencePolicy,
  databasePlannerInstruction,
  validateDatabasePersistenceArtifact,
} from "../databasePersistence.js";
import {
  validateProductContract,
  type ProductContract,
} from "../productContract.js";

function contract(): ProductContract {
  return validateProductContract({
    version: 2,
    originalPrompt:
      "Build a multi-tenant SaaS CRM for teams with database storage where admins can archive and restore contacts",
    productType: "saas_application",
    productFamilies: ["frontend", "backend", "database", "auth", "deployment"],
    targetUsers: ["Sales teams"],
    userRoles: ["admin", "team_member"],
    coreWorkflows: [
      "Manage workspace contacts",
      "Archive contacts",
      "Restore archived contacts",
    ],
    functionalRequirements: [
      {
        id: "REQ-001",
        text: "Persist workspace contacts with tenant isolation.",
        category: "workflow",
        priority: "must",
      },
      {
        id: "REQ-002",
        text: "Admins can archive and restore contacts.",
        category: "workflow",
        priority: "must",
      },
    ],
    nonFunctionalRequirements: [
      "Database writes are validated and transactional.",
      "Production data is recoverable.",
    ],
    dataModels: ["Workspace", "Contact", "Membership"],
    integrations: [],
    securityRequirements: ["Tenant data cannot cross workspace boundaries."],
    deploymentRequirements: ["Database migrations run before readiness."],
    monetizationRequirements: [],
    selectedTechnologyStack: "react-node",
    researchRequirements: [],
    runtimeRequirements: ["Node runtime with PostgreSQL persistence."],
    secondaryCapabilities: [
      "authentication",
      "database",
      "teams",
      "deployment",
    ],
    intentConfidence: 0.99,
    canonicalInterpretation:
      "Build a tenant-isolated React and Node CRM with PostgreSQL persistence.",
  });
}

function completeFiles(): Record<string, string> {
  return {
    "src/db/schema.ts": [
      'import { pgTable, serial, integer, varchar, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";',
      'export const workspaces = pgTable("workspaces", {',
      '  id: serial("id").primaryKey(),',
      '  name: varchar("name", { length: 120 }).notNull(),',
      '  createdAt: timestamp("created_at").notNull(),',
      '  updatedAt: timestamp("updated_at").notNull(),',
      '}, (t) => [uniqueIndex("workspace_name_unique").on(t.name)]);',
      'export const memberships = pgTable("memberships", {',
      '  id: serial("id").primaryKey(),',
      '  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),',
      '  createdAt: timestamp("created_at").notNull(),',
      '  updatedAt: timestamp("updated_at").notNull(),',
      '}, (t) => [index("membership_workspace_idx").on(t.workspaceId)]);',
      'export const contacts = pgTable("contacts", {',
      '  id: serial("id").primaryKey(),',
      '  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id),',
      '  name: varchar("name", { length: 160 }).notNull(),',
      '  deletedAt: timestamp("deleted_at"),',
      '  createdAt: timestamp("created_at").notNull(),',
      '  updatedAt: timestamp("updated_at").notNull(),',
      '}, (t) => [index("contact_workspace_idx").on(t.workspaceId)]);',
    ].join("\n"),
    "src/db/repository.ts": [
      'import { z } from "zod";',
      'import postgres from "postgres";',
      'import { drizzle } from "drizzle-orm/postgres-js";',
      'import { and, eq, isNull } from "drizzle-orm";',
      'import { contacts } from "./schema";',
      "const sql = postgres(process.env.DATABASE_URL!, { max: 10 });",
      "const db = drizzle(sql);",
      "const input = z.object({ workspaceId: z.number().int(), name: z.string().min(1) });",
      "export async function createContact(raw: unknown) {",
      "  const value = input.parse(raw);",
      "  try {",
      "    return await db.transaction(async (tx) =>",
      "      tx.insert(contacts).values({",
      "        workspaceId: value.workspaceId,",
      "        name: value.name,",
      "        createdAt: new Date(),",
      "        updatedAt: new Date(),",
      "      }),",
      "    );",
      "  } catch (error) {",
      '    throw new Error("Database write failed", { cause: error });',
      "  } finally {",
      "    void sql;",
      "  }",
      "}",
      "export async function listContacts(workspaceId: number) {",
      "  return db.select().from(contacts).where(",
      "    and(eq(contacts.workspaceId, workspaceId), isNull(contacts.deletedAt)),",
      "  );",
      "}",
    ].join("\n"),
    "database/migrations/20260927_initial.sql": [
      "BEGIN;",
      "CREATE TABLE IF NOT EXISTS workspaces (",
      "  id SERIAL PRIMARY KEY,",
      "  name VARCHAR(120) NOT NULL UNIQUE,",
      "  created_at TIMESTAMP NOT NULL DEFAULT NOW(),",
      "  updated_at TIMESTAMP NOT NULL DEFAULT NOW()",
      ");",
      "CREATE TABLE IF NOT EXISTS memberships (",
      "  id SERIAL PRIMARY KEY,",
      "  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),",
      "  created_at TIMESTAMP NOT NULL DEFAULT NOW(),",
      "  updated_at TIMESTAMP NOT NULL DEFAULT NOW()",
      ");",
      "CREATE TABLE IF NOT EXISTS contacts (",
      "  id SERIAL PRIMARY KEY,",
      "  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),",
      "  name VARCHAR(160) NOT NULL,",
      "  deleted_at TIMESTAMP,",
      "  created_at TIMESTAMP NOT NULL DEFAULT NOW(),",
      "  updated_at TIMESTAMP NOT NULL DEFAULT NOW()",
      ");",
      "CREATE INDEX IF NOT EXISTS contact_workspace_idx ON contacts(workspace_id);",
      "CREATE INDEX IF NOT EXISTS membership_workspace_idx ON memberships(workspace_id);",
      "COMMIT;",
    ].join("\n"),
    "database/seed.ts": [
      'if (process.env.NODE_ENV === "production") {',
      '  throw new Error("Refusing to seed production");',
      "}",
      "export const developmentSeed = {",
      '  workspace: { name: "Example Workspace" },',
      '  contact: { name: "Example Contact" },',
      "};",
    ].join("\n"),
    "docs/DATABASE_RECOVERY.md": [
      "# Database recovery",
      "Run versioned migration files in order before application readiness.",
      "Back up the database with pg_dump before production migrations.",
      "Restore backups into a separate database and verify invariants before promotion.",
      "If a migration fails, use rollback only when it is proven safe; otherwise roll forward with a corrective migration.",
    ].join("\n"),
    ".env.example": "DATABASE_URL=\n",
  };
}

describe("Section 18 generated database persistence contract", () => {
  it("derives database, tenancy, seed, and soft-delete requirements from the product contract", () => {
    const policy = databasePersistencePolicy(contract());
    expect(policy.required).toBe(true);
    expect(policy.tenantIsolationRequired).toBe(true);
    expect(policy.seedRequired).toBe(true);
    expect(policy.softDeleteRequired).toBe(true);
    expect(policy.modelNames).toEqual(["Workspace", "Contact", "Membership"]);
  });

  it("gives planner and database coder the same isolation and recovery requirements", () => {
    const planner = databasePlannerInstruction(contract());
    const coder = databaseCoderInstruction(contract());
    for (const text of [planner, coder]) {
      expect(text).toMatch(/migration/i);
      expect(text).toMatch(/backup/i);
      expect(text).toMatch(/tenant|workspace/i);
      expect(text).toMatch(/AppForge/i);
      expect(text).toMatch(/database credential|DATABASE_URL/i);
    }
  });

  it("accepts a complete contract-derived persistence layer", () => {
    expect(
      validateDatabasePersistenceArtifact({
        contract: contract(),
        files: completeFiles(),
      }),
    ).toEqual([]);
  });

  it("rejects missing migrations, seeds, recovery docs, and tenant isolation", () => {
    const files = completeFiles();
    delete files["database/migrations/20260927_initial.sql"];
    delete files["database/seed.ts"];
    delete files["docs/DATABASE_RECOVERY.md"];
    files["src/db/schema.ts"] = files["src/db/schema.ts"]
      .split("workspaceId").join("ownerKey")
      .split("workspace_id").join("owner_key");
    files["src/db/repository.ts"] = files["src/db/repository.ts"].split("workspaceId").join("ownerKey");

    const problems = validateDatabasePersistenceArtifact({
      contract: contract(),
      files,
    });

    expect(problems).toContain(
      "database contract: missing versioned migration",
    );
    expect(problems).toContain(
      "database contract: missing development/test seed data",
    );
    expect(problems).toContain(
      "database contract: missing database recovery documentation",
    );
    expect(problems).toContain(
      "database contract: tenant-scoped product schema has no tenant ownership key",
    );
  });

  it("rejects browser database credentials and AppForge production persistence references", () => {
    const files = completeFiles();
    files["src/components/Leak.tsx"] =
      "export const leaked = import.meta.env.DATABASE_URL;";
    files["src/db/repository.ts"] +=
      "\nconst forbidden = process.env.APPFORGE_DATABASE_URL;";

    const problems = validateDatabasePersistenceArtifact({
      contract: contract(),
      files,
    });

    expect(problems).toContain(
      "database contract: browser/client file exposes direct database credential material: src/components/Leak.tsx",
    );
    expect(problems).toContain(
      "database contract: generated product references AppForge production persistence",
    );
  });

  it("rejects unguarded seed scripts and hard-coded connection URIs", () => {
    const files = completeFiles();
    files["database/seed.ts"] =
      'export const seed = { contact: { name: "Unsafe" } };';
    files["src/db/repository.ts"] +=
      '\nconst DATABASE_URL="postgresql://user:password@example.invalid/app";';

    const problems = validateDatabasePersistenceArtifact({
      contract: contract(),
      files,
    });

    expect(problems).toContain(
      "database contract: seed script has no non-production safety guard",
    );
    expect(problems).toContain(
      "database contract: hard-coded database connection URI detected",
    );
  });
});

import { logger } from "../_core/logger.js";
import { invokeLLM } from "../_core/llm.js";
import type { Message } from "../_core/llm.js";

// ── Database Migration Intelligence Agent ──
// When schema changes are needed, this agent:
// 1. Analyzes the diff between old and new Drizzle schema
// 2. Generates a SAFE migration (adds columns, creates indexes, NEVER destructive)
// 3. Writes rollback SQL for every forward step
// 4. Returns a migration package ready for Drizzle Kit

export interface MigrationPackage {
  forwardSql: string;
  rollbackSql: string;
  isDestructive: boolean;
  destructiveWarning: string | null;
  indexesAdded: string[];
  tablesAdded: string[];
  columnsAdded: string[];
  safetyScore: number; // 0-100, 100 = fully safe
}

const MIGRATION_SYSTEM_PROMPT = `You are a PostgreSQL migration specialist.
You ONLY generate safe, non-destructive migration SQL.

Rules:
- ADD columns with DEFAULT values or as nullable
- CREATE new tables, new indexes
- NEVER DROP columns, NEVER DROP tables, NEVER ALTER column types that could truncate data
- If a destructive operation is truly required, flag it explicitly with -- DESTRUCTIVE: ...
- Every forward step MUST have a corresponding rollback step
- Use IF NOT EXISTS / IF EXISTS guards
- Prefer adding new columns over modifying existing ones
- Format as two SQL blocks separated by -- ROLLBACK --

Output format:
-- Forward Migration
<SQL steps>

-- Rollback --
<reverse SQL steps>`;

export async function generateSafeMigration(
  oldSchema: string,
  newSchema: string,
  projectId: number
): Promise<MigrationPackage> {
  logger.info({ projectId }, "db_migration_start");

  const messages: Message[] = [
    { role: "system", content: MIGRATION_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Old Drizzle schema:\n\`\`\`typescript\n${oldSchema}\n\`\`\`\n\nNew Drizzle schema:\n\`\`\`typescript\n${newSchema}\n\`\`\`\n\nGenerate a safe PostgreSQL migration.`,
    },
  ];

  const result = await invokeLLM({ messages, maxTokens: 4000, responseFormat: { type: "text" } });
  const text = result.choices[0]?.message?.content ?? "";

  const forwardMatch = text.match(/--\s*Forward\s*Migration\s*([\s\S]*?)(?=--\s*Rollback\s*--|$)/i);
  const rollbackMatch = text.match(/--\s*Rollback\s*--\s*([\s\S]*)/i);

  const forwardSql = forwardMatch ? forwardMatch[1].trim() : text;
  const rollbackSql = rollbackMatch ? rollbackMatch[1].trim() : "-- No rollback generated";

  const isDestructive = /DROP\s+(COLUMN|TABLE)|ALTER\s+.*\s+TYPE|DELETE\s+FROM/i.test(forwardSql);
  const destructiveWarning = isDestructive
    ? "Migration contains destructive operations. Manual review REQUIRED before running."
    : null;

  const indexesAdded = (forwardSql.match(/CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+"(\w+)"/gi) ?? []).map(m => m.match(/"(\w+)"/)?.[1] ?? m);
  const tablesAdded = (forwardSql.match(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"(\w+)"/gi) ?? []).map(m => m.match(/"(\w+)"/)?.[1] ?? m);
  const columnsAdded = (forwardSql.match(/ADD\s+COLUMN\s+"?(\w+)"?/gi) ?? []).map(m => m.match(/"?(\w+)"?/)?.[1] ?? m);

  // Safety score: deduct for destructive ops, missing rollback, no guards
  let safetyScore = 100;
  if (isDestructive) safetyScore -= 50;
  if (!rollbackMatch) safetyScore -= 20;
  if (!/IF\s+NOT\s+EXISTS/gi.test(forwardSql)) safetyScore -= 10;

  const pkg: MigrationPackage = {
    forwardSql,
    rollbackSql,
    isDestructive,
    destructiveWarning,
    indexesAdded,
    tablesAdded,
    columnsAdded,
    safetyScore: Math.max(0, safetyScore),
  };

  logger.info(
    { projectId, safetyScore, isDestructive, indexes: indexesAdded.length, tables: tablesAdded.length },
    "db_migration_complete"
  );

  return pkg;
}

/** Write migration to disk in standard Drizzle Kit format */
export async function writeMigrationToDisk(
  pkg: MigrationPackage,
  outDir: string,
  timestamp: string
): Promise<{ forwardPath: string; rollbackPath: string }> {
  const { mkdir, writeFile } = await import("fs/promises");
  const { join } = await import("path");

  await mkdir(outDir, { recursive: true });

  const forwardPath = join(outDir, `${timestamp}_migration.sql`);
  const rollbackPath = join(outDir, `${timestamp}_rollback.sql`);

  await writeFile(forwardPath, pkg.forwardSql, "utf-8");
  await writeFile(rollbackPath, pkg.rollbackSql, "utf-8");

  return { forwardPath, rollbackPath };
}

/** Estimates if migration needs user approval based on safety score */
export function needsMigrationApproval(pkg: MigrationPackage): boolean {
  return pkg.safetyScore < 80 || pkg.isDestructive;
}

export default generateSafeMigration;
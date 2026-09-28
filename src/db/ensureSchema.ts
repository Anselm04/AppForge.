import { createHash } from "node:crypto";
import postgres from "postgres";
import { ENV } from "../_core/env.js";
import { SCHEMA_SQL } from "./schemaBaseline.js";
import {
  SCHEMA_PATCH_SQL,
  SECTION18_INTEGRITY_SQL,
  SECTION24_RECOVERY_CHECKPOINTS_SQL,
} from "./schemaPatches.js";

/**
 * Idempotent Drizzle schema for Fly Postgres.
 * Leftover supabase/migrations target auth.users and must not be applied here.
 *
 * Schema SQL lives in schemaBaseline.ts + schemaPatches.ts so the immutable
 * baseline checksum stays reviewable and new migrations are additive.
 */

type AppForgeSchemaMigration = {
  version: string;
  name: string;
  sql: string;
};

const APPFORGE_SCHEMA_MIGRATIONS: readonly AppForgeSchemaMigration[] = [
  {
    version: "20260703_001",
    name: "baseline_appforge_schema",
    sql: SCHEMA_SQL,
  },
  {
    version: "20260916_002",
    name: "appforge_schema_patch",
    sql: SCHEMA_PATCH_SQL,
  },
  {
    version: "20260927_003",
    name: "section18_integrity_constraints",
    sql: SECTION18_INTEGRITY_SQL,
  },
  {
    version: "20260928_004",
    name: "section24_recovery_checkpoints",
    sql: SECTION24_RECOVERY_CHECKPOINTS_SQL,
  },
];

function migrationChecksum(migrationSql: string): string {
  return createHash("sha256").update(migrationSql, "utf8").digest("hex");
}

async function applyAppForgeSchemaMigrations(sql: postgres.Sql): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "appforge_schema_migrations" (
      "version" VARCHAR(64) PRIMARY KEY,
      "name" VARCHAR(255) NOT NULL,
      "checksum" VARCHAR(64) NOT NULL,
      "applied_at" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await sql.unsafe(
    "SELECT pg_advisory_lock(hashtext('appforge_schema_migrations_v1'))",
  );

  try {
    for (const migration of APPFORGE_SCHEMA_MIGRATIONS) {
      const checksum = migrationChecksum(migration.sql);
      const existing = await sql`
        SELECT "checksum", "name"
        FROM "appforge_schema_migrations"
        WHERE "version" = ${migration.version}
      `;
      const appliedChecksum = existing[0]?.checksum as string | undefined;
      if (appliedChecksum) {
        if (appliedChecksum !== checksum) {
          throw new Error(
            `Applied database migration ${migration.version} checksum changed; create a new migration instead of editing history`,
          );
        }
        continue;
      }

      await sql.begin(async (tx) => {
        await tx.unsafe(migration.sql);
        await tx`
          INSERT INTO "appforge_schema_migrations"
            ("version", "name", "checksum", "applied_at")
          VALUES
            (${migration.version}, ${migration.name}, ${checksum}, NOW())
        `;
      });
      console.log(
        `Applied AppForge migration ${migration.version} (${migration.name})`,
      );
    }
  } finally {
    await sql
      .unsafe(
        "SELECT pg_advisory_unlock(hashtext('appforge_schema_migrations_v1'))",
      )
      .catch(() => undefined);
  }
}

export async function ensureAppSchema(): Promise<void> {
  if (!ENV.databaseUrl) {
    if (ENV.isProduction) {
      throw new Error("DATABASE_URL is required in production");
    }
    console.warn("Skipping schema ensure: DATABASE_URL is not set");
    return;
  }
  const sql = postgres(ENV.databaseUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 5,
  });
  try {
    await applyAppForgeSchemaMigrations(sql);
    await upsertEncryptedOwner(sql);
    console.log("AppForge schema migrations complete");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function upsertEncryptedOwner(sql: postgres.Sql): Promise<void> {
  const {
    canonicalOwnerEmail,
    encryptOwnerEmail,
    ownerEmailHmac,
    isOwnerEmail,
  } = await import("../lib/serverSecrets.js");
  const email = canonicalOwnerEmail();
  if (!isOwnerEmail(email)) return;
  await sql`
    INSERT INTO users (email, name, created_at, updated_at)
    VALUES (${email}, 'Anselm Perkins', NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(NULLIF("users"."name", ''), EXCLUDED.name),
      updated_at = NOW()
  `;
  try {
    const enc = encryptOwnerEmail(email);
    const hmac = ownerEmailHmac(email);
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('owner_email_enc', ${enc}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    await sql`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES ('owner_email_hmac', ${hmac}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
  } catch (err) {
    console.warn("Owner identity encrypt skipped (server secret not ready)");
  }
}

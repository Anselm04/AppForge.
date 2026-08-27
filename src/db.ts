import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./db/schema.js";
import { ENV } from "./_core/env.js";
import { eq, desc, and, gte } from "drizzle-orm";

// Connection pooling: max 10 connections, 30s idle timeout
const client = postgres(ENV.databaseUrl, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  prepare: false, // Disable prepared statements for connection poolers (e.g., Supabase, PgBouncer)
});

export const db = drizzle(client, { schema });

// Graceful DB connection cleanup
export async function closeDbConnection(): Promise<void> {
  await client.end({ timeout: 5 });
}

// ── USERS ──
export async function getUserById(id: number) {
  return db.query.users.findFirst({ where: eq(schema.users.id, id) });
}

export async function getUserByOpenId(openId: string) {
  return db.query.users.findFirst({ where: eq(schema.users.openId, openId) });
}

export async function createUser(data: {
  openId?: string;
  email?: string;
  name?: string;
  picture?: string;
}) {
  const result = await db.insert(schema.users).values(data).returning();
  return result[0];
}

export { upsertUserFromAuth, applyGodCodeGrant } from "./dbGrants.js";
export * from "./dbSubs.js";
export * from "./dbProjects.js";
export * from "./dbCredits.js";
export * from "./dbTasks.js";

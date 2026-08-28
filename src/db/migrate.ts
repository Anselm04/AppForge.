/**
 * Applies the AppForge Drizzle schema (idempotent).
 * The ./drizzle SQL folder is optional; boot-time ensureAppSchema() is the source of truth.
 */
import { ensureAppSchema } from "./ensureSchema.js";

console.log("🚀 Ensuring AppForge database schema...");
await ensureAppSchema();
console.log("✅ Schema ready");

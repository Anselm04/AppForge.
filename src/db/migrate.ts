/**
 * Applies the authoritative AppForge production migration chain.
 *
 * Migration history, advisory locking, checksums and transactional execution
 * live in ensureAppSchema(). SQL under drizzle/ is supporting history/diff
 * material and is not a second production migration engine.
 */
import { ensureAppSchema } from "./ensureSchema.js";

console.log("Applying AppForge database migrations...");
await ensureAppSchema();
console.log("AppForge database migrations complete");

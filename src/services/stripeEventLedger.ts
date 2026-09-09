import postgres from "postgres";
import { ENV } from "../_core/env.js";

let ledgerReady: Promise<void> | null = null;

function databaseUrl(): string {
  if (!ENV.databaseUrl) {
    throw new Error("DATABASE_URL is required for Stripe webhook replay protection");
  }
  return ENV.databaseUrl;
}

function createSql() {
  return postgres(databaseUrl(), { max: 1, prepare: false });
}

async function ensureLedger(): Promise<void> {
  if (!ledgerReady) {
    ledgerReady = (async () => {
      const sql = createSql();
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS stripe_webhook_events (
            event_id VARCHAR(255) PRIMARY KEY,
            event_type VARCHAR(100) NOT NULL,
            processed_at TIMESTAMP NOT NULL DEFAULT NOW()
          )
        `;
        await sql`
          CREATE INDEX IF NOT EXISTS stripe_webhook_events_processed_at_idx
          ON stripe_webhook_events (processed_at)
        `;
      } finally {
        await sql.end({ timeout: 5 });
      }
    })().catch((err) => {
      ledgerReady = null;
      throw err;
    });
  }
  await ledgerReady;
}

export async function processStripeEventOnce(
  eventId: string,
  eventType: string,
  handler: () => Promise<void>,
): Promise<boolean> {
  await ensureLedger();
  const sql = createSql();
  try {
    return await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${eventId}, 0))`;

      const existing = await tx`
        SELECT event_id
        FROM stripe_webhook_events
        WHERE event_id = ${eventId}
        LIMIT 1
      `;
      if (existing.length > 0) return false;

      await handler();

      await tx`
        INSERT INTO stripe_webhook_events (event_id, event_type, processed_at)
        VALUES (${eventId}, ${eventType}, NOW())
      `;
      return true;
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

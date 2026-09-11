import postgres from "postgres";
import { ENV } from "../_core/env.js";

function databaseUrl(): string {
  if (!ENV.databaseUrl) {
    throw new Error(
      "DATABASE_URL is required for Stripe webhook replay protection",
    );
  }
  return ENV.databaseUrl;
}

function createSql() {
  return postgres(databaseUrl(), { max: 1, prepare: false });
}

export async function processStripeEventOnce(
  eventId: string,
  eventType: string,
  handler: () => Promise<void>,
): Promise<boolean> {
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

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
        SELECT stripe_event_id
        FROM public.stripe_webhook_events
        WHERE stripe_event_id = ${eventId}
        LIMIT 1
      `;
      if (existing.length > 0) return false;

      await handler();

      await tx`
        INSERT INTO public.stripe_webhook_events (stripe_event_id, event_type)
        VALUES (${eventId}, ${eventType})
      `;
      return true;
    });
  } finally {
    await sql.end({ timeout: 5 });
  }
}

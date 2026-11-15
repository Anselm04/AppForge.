import { beforeEach, describe, expect, it, vi } from "vitest";

// No Stripe SDK request, database socket, or external provider is used.
const state = vi.hoisted(() => ({
  processed: new Set<string>(),
  transactionCount: 0,
  closed: 0,
}));
vi.mock("../_core/env.js", () => ({
  ENV: { databaseUrl: "postgres://offline:offline@localhost/offline" },
}));
vi.mock("postgres", () => ({
  default: () => ({
    begin: async (handler: (tx: unknown) => Promise<unknown>) => {
      state.transactionCount++;
      let pending: string | undefined;
      const tx = async (
        fragments: TemplateStringsArray,
        ...values: unknown[]
      ): Promise<Array<{ event_id: string }>> => {
        const query = fragments.join("?").toLowerCase();
        if (query.includes("pg_advisory_xact_lock")) return [];
        if (query.includes("select event_id")) {
          const id = String(values[0]);
          return state.processed.has(id) ? [{ event_id: id }] : [];
        }
        if (query.includes("insert into stripe_webhook_events")) {
          pending = String(values[0]);
          return [];
        }
        throw new Error("Unexpected SQL in hermetic Stripe ledger: " + query);
      };
      const result = await handler(tx);
      // Commit only after successful handler completion.
      if (pending) state.processed.add(pending);
      return result;
    },
    end: async () => {
      state.closed++;
    },
  }),
}));
import { processStripeEventOnce } from "../services/stripeEventLedger.js";

describe("Stripe event ledger: hermetic replay contract", () => {
  beforeEach(() => {
    state.processed.clear();
    state.transactionCount = 0;
    state.closed = 0;
  });

  it("processes the first paid event and ignores its replay", async () => {
    let creditsGranted = 0;
    const grant = async () => {
      creditsGranted += 50;
    };
    expect(await processStripeEventOnce("evt_paid_1", "checkout.session.completed", grant)).toBe(true);
    expect(await processStripeEventOnce("evt_paid_1", "checkout.session.completed", grant)).toBe(false);
    expect(creditsGranted).toBe(50);
    expect(state.transactionCount).toBe(2);
    expect(state.closed).toBe(2);
  });

  it("retries a failed event instead of marking it processed", async () => {
    await expect(
      processStripeEventOnce("evt_failed_1", "invoice.payment_failed", async () => {
        throw new Error("database write failed");
      }),
    ).rejects.toThrow("database write failed");
    let deliveries = 0;
    expect(await processStripeEventOnce("evt_failed_1", "invoice.payment_failed", async () => {
      deliveries++;
    })).toBe(true);
    expect(deliveries).toBe(1);
    expect(state.closed).toBe(2);
  });

  it("does not conflate two independently paid invoice events", async () => {
    let grants = 0;
    for (const id of ["evt_invoice_a", "evt_invoice_b", "evt_invoice_a"]) {
      await processStripeEventOnce(id, "invoice.paid", async () => {
        grants++;
      });
    }
    expect(grants).toBe(2);
  });
});

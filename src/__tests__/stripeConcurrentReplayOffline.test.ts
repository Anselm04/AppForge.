import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  seen: new Set<string>(),
  locks: new Map<string, Promise<void>>(),
  grants: 0,
}));

vi.mock("../_core/env.js", () => ({
  ENV: { databaseUrl: "postgres://fixture:fixture@localhost/fixture" },
}));

type MockTx = (
  fragments: TemplateStringsArray,
  ...args: unknown[]
) => Promise<unknown[]>;

vi.mock("postgres", () => ({
  default: () => ({
    begin: async (handler: (tx: MockTx) => Promise<boolean>) => {
      let pending: string | undefined;
      let unlock: (() => void) | undefined;
      try {
        const result = await handler(async (fragments, ...args) => {
          const statement = fragments.join("?").toLowerCase();
          const eventId = String(args[0]);
          if (statement.includes("pg_advisory_xact_lock")) {
            const prior = state.locks.get(eventId) ?? Promise.resolve();
            let release!: () => void;
            const current = new Promise<void>((resolve) => {
              release = resolve;
            });
            state.locks.set(eventId, prior.then(() => current));
            await prior;
            unlock = release;
            return [];
          }
          if (statement.includes("select event_id")) {
            return state.seen.has(eventId) ? [{ event_id: eventId }] : [];
          }
          if (statement.includes("insert into stripe_webhook_events")) {
            pending = eventId;
            return [];
          }
          throw new Error("Unexpected SQL in concurrent test");
        });
        if (pending) state.seen.add(pending);
        return result;
      } finally {
        unlock?.();
      }
    },
    end: async () => undefined,
  }),
}));

import { processStripeEventOnce } from "../services/stripeEventLedger.js";

describe("two concurrent identical webhook deliveries", () => {
  it("does not double-credit while transactional event lock is held", async () => {
    state.seen.clear();
    state.locks.clear();
    state.grants = 0;
    const fulfill = async () => {
      await Promise.resolve();
      state.grants += 50;
    };
    const results = await Promise.all([
      processStripeEventOnce("evt_simultaneous", "invoice.paid", fulfill),
      processStripeEventOnce("evt_simultaneous", "invoice.paid", fulfill),
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect(state.grants).toBe(50);
  });
});

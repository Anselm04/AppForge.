import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { userId: number; projectId: number; executionId: number; operationId: string;
  period: string; maximumCents: number; actualCents: number | null; state: string };
const state = vi.hoisted(() => ({
  reservations: [] as Row[],
  queue: Promise.resolve() as Promise<unknown>,
  subscriptionStatus: "active" as string,
  subscriptionTier: "starter" as string,
  subscriptionPeriodEnd: new Date(Date.now() + 86400000) as Date | null,
}));
vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...parameters: unknown[]) => ({
    text: strings.join("?"), parameters,
  }),
}));
vi.mock("../db.js", () => ({
  db: {
    transaction: async (run: (tx: { execute: (sql: unknown) => Promise<unknown> }) => Promise<unknown>) => {
      // Model the serialized customer-row transaction, including rollback.
      const wait = state.queue;
      let unlock!: () => void;
      state.queue = new Promise<void>((resolve) => { unlock = resolve; });
      await wait;
      const snapshot = state.reservations.map((row) => ({ ...row }));
      try {
        return await run({ execute: async (query: unknown) => {
          const { text, parameters: p } = query as {text: string; parameters: unknown[]};
          if (text.includes("SELECT id FROM users")) return p[0] === 1 ? [{ id: 1 }] : [];
          if (text.includes("SELECT id FROM projects")) return p[0] === 10 && p[1] === 1 ? [{ id: 10 }] : [];
          if (text.includes("FROM subscriptions")) return [{ tier: state.subscriptionTier, status: state.subscriptionStatus, periodEnd: state.subscriptionPeriodEnd, trialEnd: null }];
          if (text.includes("SELECT state, maximum_cents")) {
            const found = state.reservations.find((r) => r.userId === p[0] && r.operationId === p[1]);
            return found ? [{
              state: found.state, maximumCents: String(found.maximumCents),
              actualCents: found.actualCents === null ? null : String(found.actualCents),
              projectId: found.projectId, executionId: found.executionId,
            }] : [];
          }
          if (text.includes("SELECT COALESCE(SUM")) {
            const total = state.reservations
              .filter((r) => r.userId === p[0] && (r.state === "reserved" || (r.period === p[1] && r.state === "settled")))
              .reduce((sum, r) => sum + (r.actualCents ?? r.maximumCents), 0);
            return [{ total: String(total) }];
          }
          if (text.includes("INSERT INTO provider_spend_reservations")) {
            state.reservations.push({
              operationId: String(p[0]), userId: Number(p[1]), projectId: Number(p[2]),
              executionId: Number(p[3]), period: String(p[4]), maximumCents: Number(p[5]),
              actualCents: null, state: "reserved",
            });
            return [];
          }
          if (text.includes("UPDATE provider_spend_reservations")) {
            const found = state.reservations.find((r) => r.userId === p[1] && r.operationId === p[2]);
            if (!found) throw Error("Missing reservation");
            found.state = "settled";
            found.actualCents = Number(p[0]);
            return [];
          }
          throw Error("Unrecognized mocked SQL operation: " + text);
        } });
      } catch (error) {
        state.reservations = snapshot;
        throw error;
      } finally { unlock(); }
    },
  },
}));

import { reserveProviderSpend, settleProviderSpend } from "../services/providerSpendLedger.js";
const input = (operationId = "build_1234", maximumCents = 60) => ({
  userId: 1, projectId: 10, executionId: 22, operationId,
  maximumCents,
});
beforeEach(() => {
  state.reservations = [];
  state.subscriptionStatus = "active";
  state.subscriptionTier = "starter";
  state.subscriptionPeriodEnd = new Date(Date.now() + 86400000);
});
describe("offline customer money reservation and settlement", () => {
  it("allows one reservation and treats an identical retry as idempotent", async () => {
    expect(await reserveProviderSpend(input())).toBe("reserved");
    expect(await reserveProviderSpend(input())).toBe("duplicate");
    expect(state.reservations).toHaveLength(1);
  });
  it("rejects a conflicting retry and cross-customer or project attribution", async () => {
    await reserveProviderSpend(input());
    await expect(reserveProviderSpend(input("build_1234", 80))).rejects.toThrow(/Conflicting/);
    await expect(reserveProviderSpend({ ...input("other_123"), projectId: 11 }))
      .rejects.toThrow(/ownership/);
    await expect(reserveProviderSpend({ ...input("other_124"), userId: 2 }))
      .rejects.toThrow(/Customer not found/);
  });
  it("counts in-flight costs and blocks concurrent oversubscription", async () => {
    const result = await Promise.allSettled([
      reserveProviderSpend(input("request_1", 700)),
      reserveProviderSpend(input("request_2", 700)),
    ]);
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(result.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(state.reservations).toHaveLength(1);
  });
  it("holds previous-month unresolved charges against the new month budget", async () => {
    await reserveProviderSpend(input("carryover_1", 1100));
    // Simulate a new calendar period while the provider invoice is pending.
    state.reservations[0].period = "2026-10-01";
    await expect(reserveProviderSpend(input("next_month_2", 150)))
      .rejects.toThrow(/budget exhausted/);
    // Once an old-month charge is verified and settled, it belongs only to
    // the original period; a new month's allowance can be used.
    await settleProviderSpend(1, "carryover_1", 1000);
    expect(await reserveProviderSpend(input("next_month_2", 150))).toBe("reserved");
  });
  it("does not treat unknown charges, invalid money or zero allowance as free", async () => {
    await reserveProviderSpend(input("unknown_1", 1175));
    await expect(reserveProviderSpend(input("unknown_2", 30)))
      .rejects.toThrow(/budget exhausted/);
    await expect(reserveProviderSpend(input("invalid_1", Number.NaN)))
      .rejects.toThrow(/Invalid/);
    await expect(reserveProviderSpend(input("invalid_2", 0)))
      .rejects.toThrow(/Invalid/);
  });
  it("denies unpaid and unknown subscription tiers regardless of requested amount", async () => {
    state.subscriptionStatus = "canceled";
    await expect(reserveProviderSpend(input("canceled_1"))).rejects.toThrow(/subscription/);
    state.subscriptionStatus = "active";
    state.subscriptionTier = "enterprise";
    await expect(reserveProviderSpend(input("unsupported_1"))).rejects.toThrow(/subscription/);
    expect(state.reservations).toHaveLength(0);
  });
  it("rejects missing and expired paid billing periods", async () => {
    state.subscriptionPeriodEnd = null;
    await expect(reserveProviderSpend(input("missing_period_1")))
      .rejects.toThrow(/subscription/);
    state.subscriptionPeriodEnd = new Date("2020-01-01T00:00:00Z");
    await expect(reserveProviderSpend(input("expired_period_1")))
      .rejects.toThrow(/subscription/);
    expect(state.reservations).toHaveLength(0);
  });
  it("settles known costs exactly once, rejecting cost overrun and contradictory receipts", async () => {
    await reserveProviderSpend(input());
    await expect(settleProviderSpend(1, "build_1234", 61)).rejects.toThrow(/exceeds/);
    expect(state.reservations[0].state).toBe("reserved");
    await settleProviderSpend(1, "build_1234", 40);
    await settleProviderSpend(1, "build_1234", 40);
    await expect(settleProviderSpend(1, "build_1234", 41)).rejects.toThrow(/Conflicting/);
    expect(state.reservations[0].actualCents).toBe(40);
  });
});

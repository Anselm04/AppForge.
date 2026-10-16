import { describe, expect, it, vi } from "vitest";
import {
  assertRecentSession,
  completeAccountDeletion,
  normalizeAccountPreferences,
  type AccountDeletionDependencies,
} from "../accountLifecycle.js";

function jwtWithIat(iat: number) {
  const payload = Buffer.from(JSON.stringify({ iat })).toString("base64url");
  return `x.${payload}.x`;
}

function deletionDeps(
  overrides: Partial<AccountDeletionDependencies> = {},
): AccountDeletionDependencies {
  return {
    loadUser: vi.fn(async () => ({ id: 7, openId: "supabase-user" })),
    beginDeletion: vi.fn(async () => undefined),
    stopCustomerWork: vi.fn(async () => undefined),
    disableEntitlements: vi.fn(async () => undefined),
    revokeIdentity: vi.fn(async () => undefined),
    deleteCustomerProjects: vi.fn(async () => undefined),
    deleteProviderConnections: vi.fn(async () => undefined),
    anonymizeAccount: vi.fn(async () => undefined),
    recordAudit: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("account lifecycle", () => {
  it("requires a recent authenticated session for irreversible deletion", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(() => assertRecentSession(jwtWithIat(now - 60), now)).not.toThrow();
    expect(() => assertRecentSession(jwtWithIat(now - 3600), now)).toThrow(
      /sign in again/i,
    );
    expect(() => assertRecentSession("invalid", now)).toThrow(/sign in again/i);
  });

  it("normalizes only supported customer preferences", () => {
    expect(
      normalizeAccountPreferences({
        language: "mi-NZ",
        communications: { product: true, billing: true, marketing: false },
        accessibility: { reducedMotion: true, highContrast: false },
      }),
    ).toEqual({
      language: "mi-NZ",
      communications: { product: true, billing: true, marketing: false },
      accessibility: { reducedMotion: true, highContrast: false },
    });
  });

  it("disables work and entitlements before revoking identity, then removes customer data and anonymizes", async () => {
    const order: string[] = [];
    const deps = deletionDeps({
      beginDeletion: vi.fn(async () => void order.push("begin")),
      stopCustomerWork: vi.fn(async () => void order.push("stop-work")),
      disableEntitlements: vi.fn(
        async () => void order.push("disable-entitlements"),
      ),
      revokeIdentity: vi.fn(async () => void order.push("revoke-identity")),
      deleteCustomerProjects: vi.fn(
        async () => void order.push("delete-projects"),
      ),
      deleteProviderConnections: vi.fn(
        async () => void order.push("delete-connections"),
      ),
      anonymizeAccount: vi.fn(async () => void order.push("anonymize")),
      recordAudit: vi.fn(async () => void order.push("audit")),
    });

    await completeAccountDeletion(7, deps);

    expect(order).toEqual([
      "begin",
      "stop-work",
      "disable-entitlements",
      "revoke-identity",
      "delete-projects",
      "delete-connections",
      "anonymize",
      "audit",
    ]);
  });

  it("fails closed before destructive cleanup when identity revocation fails", async () => {
    const deps = deletionDeps({
      revokeIdentity: vi.fn(async () => {
        throw new Error("provider unavailable");
      }),
    });

    await expect(completeAccountDeletion(7, deps)).rejects.toThrow(
      /provider unavailable/i,
    );
    expect(deps.deleteCustomerProjects).not.toHaveBeenCalled();
    expect(deps.deleteProviderConnections).not.toHaveBeenCalled();
    expect(deps.anonymizeAccount).not.toHaveBeenCalled();
    expect(deps.recordAudit).not.toHaveBeenCalled();
  });
});

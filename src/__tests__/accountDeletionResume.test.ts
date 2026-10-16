import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getState: vi.fn(async () => "pending" as const),
  getUserById: vi.fn(async () => ({ id: 7, openId: null as string | null })),
  verifyIdentity: vi.fn(async () => undefined),
  assertRecent: vi.fn(() => undefined),
  completeDeletion: vi.fn(async () => undefined),
}));

vi.mock("../db.js", () => ({
  getUserById: mocks.getUserById,
}));

vi.mock("../services/accountLifecycleService.js", () => ({
  getAccountLifecycleState: mocks.getState,
  getAccountLifecycleProfile: vi.fn(),
  updateAccountLifecycleProfile: vi.fn(),
  productionAccountDeletionDependencies: vi.fn(() => ({ marker: true })),
}));

vi.mock("../services/supabaseAccountAdmin.js", () => ({
  verifySupabaseAuthUser: mocks.verifyIdentity,
}));

vi.mock("../lib/accountLifecycle.js", () => ({
  assertRecentSession: mocks.assertRecent,
  completeAccountDeletion: mocks.completeDeletion,
}));

vi.mock("../lib/customerDataExport.js", () => ({
  buildCustomerDataExport: vi.fn(),
}));

import { accountRouter } from "../routers/account.js";

describe("account deletion resume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getState.mockResolvedValue("pending");
    mocks.getUserById.mockResolvedValue({ id: 7, openId: null });
  });

  it("allows an authenticated pending account to resume deletion without re-verifying a provider identity that may already be gone", async () => {
    const caller = accountRouter.createCaller({
      req: {} as never,
      res: {} as never,
      user: { id: 7, email: "customer@example.com", name: "Customer" },
    });

    await expect(
      caller.deleteAccount({
        confirmation: "DELETE MY APPFORGE ACCOUNT",
        accessToken: "x.eyJpYXQiOjF9.signature-token",
      }),
    ).resolves.toEqual({ deleted: true });

    expect(mocks.assertRecent).toHaveBeenCalled();
    expect(mocks.verifyIdentity).not.toHaveBeenCalled();
    expect(mocks.completeDeletion).toHaveBeenCalledWith(7, { marker: true });
  });
});

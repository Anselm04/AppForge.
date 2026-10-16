import { beforeEach, describe, expect, it, vi } from "vitest";

const exportData = vi.hoisted(() =>
  vi.fn(async (userId: number) => ({ userId })),
);

vi.mock("../lib/customerDataExport.js", () => ({
  buildCustomerDataExport: exportData,
}));

const lifecycleState = vi.hoisted(() => vi.fn(async () => "active"));
vi.mock("../services/accountLifecycleService.js", () => ({
  getAccountLifecycleState: lifecycleState,
}));

import { accountRouter } from "../routers/account.js";

describe("accountRouter.exportData", () => {
  beforeEach(() => {
    lifecycleState.mockReset().mockResolvedValue("active");
  });
  it("exports only the authenticated customer's account", async () => {
    const caller = accountRouter.createCaller({
      req: {} as never,
      res: {} as never,
      user: { id: 7, email: "customer@example.com", name: "Customer" },
    });

    await expect(caller.exportData()).resolves.toEqual({ userId: 7 });
    expect(exportData).toHaveBeenCalledWith(7);
  });

  it.each(["pending", "completed"])(
    "blocks export for a %s account",
    async (state) => {
      lifecycleState.mockResolvedValue(state);
      const caller = accountRouter.createCaller({
        req: {} as never,
        res: {} as never,
        user: { id: 7, email: "customer@example.com", name: "Customer" },
      });
      await expect(caller.exportData()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(exportData).not.toHaveBeenCalled();
      expect(lifecycleState).toHaveBeenCalledWith(7);
    },
  );

  it("fails closed when lifecycle persistence is unavailable", async () => {
    lifecycleState.mockRejectedValue(
      new Error("Lifecycle database unavailable"),
    );
    const caller = accountRouter.createCaller({
      req: {} as never,
      res: {} as never,
      user: { id: 7, email: "customer@example.com", name: "Customer" },
    });
    await expect(caller.exportData()).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
    expect(exportData).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers before the export service runs", async () => {
    const caller = accountRouter.createCaller({
      req: {} as never,
      res: {} as never,
      user: null,
    });

    await expect(caller.exportData()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(exportData).not.toHaveBeenCalled();
    expect(lifecycleState).not.toHaveBeenCalled();
  });
});

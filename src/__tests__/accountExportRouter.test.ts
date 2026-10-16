import { describe, expect, it, vi } from "vitest";

const exportData = vi.hoisted(() =>
  vi.fn(async (userId: number) => ({ userId })),
);

vi.mock("../lib/customerDataExport.js", () => ({
  buildCustomerDataExport: exportData,
}));

import { accountRouter } from "../routers/account.js";

describe("accountRouter.exportData", () => {
  it("exports only the authenticated customer's account", async () => {
    const caller = accountRouter.createCaller({
      req: {} as never,
      res: {} as never,
      user: { id: 7, email: "customer@example.com", name: "Customer" },
    });

    await expect(caller.exportData()).resolves.toEqual({ userId: 7 });
    expect(exportData).toHaveBeenCalledWith(7);
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
  });
});

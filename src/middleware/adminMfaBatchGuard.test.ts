import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { adminMfaBatchGuard } from "./adminMfaBatchGuard.js";
describe("admin MFA batch rate-limit boundary", () => {
  it.each([
    "/admin.requestMfa,admin.requestMfa",
    "/auth.me,admin.verifyMfa",
    "/admin%2ErequestMfa%2Cauth.me",
    "/admin%2ErequestMfa",
  ])("rejects batches and encoded paths that bypass MFA limits: %s", (path) => {
    const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
    res.status.mockReturnValue(res);
    const next = vi.fn();
    adminMfaBatchGuard({ path } as Request, res as unknown as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });
  it.each(["/admin.requestMfa", "/admin.verifyMfa", "/auth.me,projects.list"])(
    "preserves standalone MFA limits and ordinary batches: %s",
    (path) => {
      const next = vi.fn();
      adminMfaBatchGuard({ path } as Request, {} as Response, next);
      expect(next).toHaveBeenCalledOnce();
    },
  );
});

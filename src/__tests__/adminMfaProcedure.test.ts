import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { ENV } from "../_core/env.js";
import { adminRouter } from "../routers/admin.js";

const boundary = vi.hoisted(() => ({
  check: vi.fn(),
  send: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("../db.js", () => ({
  db: { insert: () => ({ values: boundary.audit }) },
  applyGodCodeGrant: vi.fn(),
  getProjectEvidenceBundle: vi.fn(),
}));
vi.mock("../_core/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_core/env.js")>();
  return {
    ENV: {
      ...actual.ENV,
      ownerPhone: "+15555550123",
      cookieSecret: "test-secret".repeat(4),
    },
  };
});
vi.mock("../lib/twilioSms.js", () => ({
  isTwilioVerifyConfigured: () => true,
  checkTwilioVerification: boundary.check,
  requestTwilioVerification: boundary.send,
  isTwilioConfigured: () => true,
  generateOtp: vi.fn(),
  hashOtp: vi.fn(),
  sendSms: vi.fn(),
}));

function session(email = ENV.ownerEmail) {
  const req = {
    headers: { authorization: "Bearer owner-session", "user-agent": "browser" },
    cookies: {},
  } as unknown as Request;
  const res = { cookie: vi.fn(), clearCookie: vi.fn() } as unknown as Response;
  return {
    req,
    res,
    caller: adminRouter.createCaller({
      req,
      res,
      user: { id: 42, email, name: "Owner" },
    }),
  };
}

describe("owner SMS verification procedure", () => {
  beforeEach(() => {
    boundary.check.mockReset().mockResolvedValue(true);
    boundary.audit.mockReset().mockResolvedValue(undefined);
  });

  it("accepts a real six-digit code and unlocks only that authenticated session", async () => {
    const { req, res, caller } = session();
    await expect(caller.verifyMfa({ code: "123456" })).resolves.toMatchObject({
      verified: true,
    });
    expect(boundary.check).toHaveBeenCalledWith("+15555550123", "123456");
    const [name, value] = vi.mocked(res.cookie).mock.calls[0];
    req.cookies = { [name]: value };
    await expect(caller.me()).resolves.toMatchObject({ isOwner: true });
    req.headers.authorization = "Bearer different-session";
    await expect(caller.me()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each(["12345", "1234567", "abcdef", "\\dddddd", "１２３４５６"])(
    "rejects malformed code %s before contacting Twilio",
    async (code) => {
      await expect(session().caller.verifyMfa({ code })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(boundary.check).not.toHaveBeenCalled();
    },
  );

  it("keeps admin locked for a rejected, expired, or reused code", async () => {
    boundary.check.mockResolvedValue(false);
    const { caller, res } = session();
    await expect(caller.verifyMfa({ code: "123456" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(res.cookie).not.toHaveBeenCalled();
    await expect(caller.me()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps admin locked when Twilio fails", async () => {
    boundary.check.mockRejectedValue(new Error("provider unavailable"));
    const { caller, res } = session();
    await expect(caller.verifyMfa({ code: "123456" })).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("does not issue admin access when the required audit write fails", async () => {
    boundary.audit.mockRejectedValue(new Error("audit database unavailable"));
    const { caller, res } = session();
    await expect(caller.verifyMfa({ code: "123456" })).rejects.toThrow();
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("does not give normal customers any owner MFA or admin privileges", async () => {
    const { caller } = session("customer@example.invalid");
    await expect(caller.requestMfa()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller.verifyMfa({ code: "123456" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(caller.me()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(boundary.check).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  smsRequest: vi.fn(),
  smsCheck: vi.fn(),
}));
vi.mock("../db.js", () => ({
  db: { insert: mocks.insert },
  applyGodCodeGrant: vi.fn(),
  getProjectEvidenceBundle: vi.fn(),
}));
vi.mock("../services/accountLifecycleService.js", () => ({
  getAccountLifecycleState: async () => "active",
}));
vi.mock("../services/build-queue.js", () => ({
  getBuildQueueDiagnostics: vi.fn(),
}));
vi.mock("../lib/twilioSms.js", () => ({
  isTwilioVerifyConfigured: () => true,
  isTwilioConfigured: () => true,
  requestTwilioVerification: mocks.smsRequest,
  checkTwilioVerification: mocks.smsCheck,
  generateOtp: () => "654321",
  hashOtp: vi.fn(),
  sendSms: vi.fn(),
  TwilioVerificationDeliveryError: class extends Error {
    constructor(
      public httpStatus: number,
      public providerCode?: number,
    ) {
      super("SMS rejected");
    }
  },
}));
import { TwilioVerificationDeliveryError } from "../lib/twilioSms.js";
import { ENV } from "../_core/env.js";
import { adminRouter } from "../routers/admin.js";
import { protectedProcedure, router } from "../_core/trpc.js";
import { setAdminMfaCookie } from "../lib/adminMfa.js";

const ownerEmail = "anselm.perkins@gmail.com";
const testRouter = router({
  unlimitedAction: protectedProcedure.query(() => ({ allowed: true })),
});
function context(
  email = ownerEmail,
  verified = false,
  sessionId = "session-1",
) {
  const token = `header.${Buffer.from(JSON.stringify({ sub: "owner-identity", session_id: sessionId })).toString("base64url")}.signature`;
  const req = {
    authAccessToken: token,
    headers: { "user-agent": "owner-browser" },
    cookies: {},
  } as unknown as Request;
  const res = {
    cookie: vi.fn((name: string, value: string) => {
      req.cookies[name] = value;
    }),
    clearCookie: vi.fn((name: string) => {
      delete req.cookies[name];
    }),
  } as unknown as Response;
  if (verified) setAdminMfaCookie(req, res, 7);
  return {
    req,
    res,
    user: {
      id: 7,
      supabaseUid: "owner-identity",
      email,
      name: "Owner",
      phoneVerified: true,
    },
  };
}

describe("owner account and god-code authorization", () => {
  const originalSecret = ENV.cookieSecret;
  const originalPhone = ENV.ownerPhone;
  beforeEach(() => {
    ENV.cookieSecret = "test-cookie-secret".padEnd(40, "x");
    ENV.ownerPhone = "+15551234567";
    mocks.insert.mockReturnValue({
      values: () => ({
        returning: async () => [{ id: 1, createdAt: new Date() }],
      }),
    });
  });
  afterEach(() => {
    ENV.cookieSecret = originalSecret;
    ENV.ownerPhone = originalPhone;
  });

  it("rejects anonymous god-code creation", async () => {
    const ctx = context();
    await expect(
      adminRouter
        .createCaller({ ...ctx, user: null })
        .createCode({ grantType: "limited", credits: 10 }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects a non-owner even when they have their own signed MFA cookie", async () => {
    await expect(
      adminRouter
        .createCaller(context("customer@example.com", true))
        .createCode({ grantType: "limited", credits: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("does not unlock god-code creation with only the owner's primary login", async () => {
    await expect(
      adminRouter
        .createCaller(context())
        .createCode({ grantType: "limited", credits: 10 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("allows a phone-verified owner to use normal APIs without admin SMS approval", async () => {
    await expect(
      testRouter.createCaller(context()).unlimitedAction(),
    ).resolves.toEqual({ allowed: true });
    await expect(
      testRouter.createCaller(context(ownerEmail, true)).unlimitedAction(),
    ).resolves.toEqual({ allowed: true });
  });

  it.each([ownerEmail, "customer@example.com"])(
    "requires phone verification for normal APIs for %s even with admin MFA",
    async (email) => {
      const ctx = context(email, true);
      ctx.user.phoneVerified = false;
      await expect(
        testRouter.createCaller(ctx).unlimitedAction(),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Phone verification required",
      });
    },
  );

  it("allows ordinary verified customers to use their own account without owner MFA", async () => {
    await expect(
      testRouter
        .createCaller(context("customer@example.com"))
        .unlimitedAction(),
    ).resolves.toEqual({ allowed: true });
  });

  it("does not check an admin code unless this browser requested the challenge", async () => {
    await expect(
      adminRouter.createCaller(context()).verifyMfa({ code: "123456" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.smsCheck).not.toHaveBeenCalled();
  });

  it("exposes admin identity only after a valid owner session and MFA", async () => {
    await expect(
      adminRouter.createCaller(context(ownerEmail, true)).me(),
    ).resolves.toEqual({ email: ownerEmail, isOwner: true });
  });

  it("sends admin SMS only to the server-configured owner number and consumes the challenge", async () => {
    const ctx = context();
    mocks.smsRequest.mockResolvedValue(undefined);
    mocks.smsCheck.mockResolvedValue(true);
    const caller = adminRouter.createCaller(ctx);
    await caller.requestMfa();
    expect(mocks.smsRequest).toHaveBeenCalledWith(ENV.ownerPhone);
    await caller.verifyMfa({ code: "123456" });
    expect(mocks.smsCheck).toHaveBeenCalledWith(ENV.ownerPhone, "123456");
    expect(ctx.req.cookies.appforge_admin_challenge).toBeUndefined();
    await expect(caller.me()).resolves.toEqual({
      email: ownerEmail,
      isOwner: true,
    });
  });

  it("rejects an admin challenge copied into a different owner login session", async () => {
    const first = context();
    mocks.smsRequest.mockResolvedValue(undefined);
    await adminRouter.createCaller(first).requestMfa();
    const other = context(ownerEmail, false, "different-session");
    other.req.cookies = { ...first.req.cookies };
    await expect(
      adminRouter.createCaller(other).verifyMfa({ code: "123456" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(mocks.smsCheck).not.toHaveBeenCalled();
  });

  it("accepts the development fallback after 21608 through the normal verification flow", async () => {
    const production = ENV.isProduction;
    ENV.isProduction = false;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mocks.smsRequest.mockRejectedValue(
        new TwilioVerificationDeliveryError(403, 21608),
      );
      const ctx = context();
      const caller = adminRouter.createCaller(ctx);
      const result = await caller.requestMfa();
      expect(result).toMatchObject({
        fallback: true,
        testCode: "654321",
      });
      await expect(caller.verifyMfa({ code: "111111" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await caller.verifyMfa({ code: "654321" });
      expect(mocks.smsCheck).not.toHaveBeenCalled();
      await expect(caller.me()).resolves.toMatchObject({ isOwner: true });
      await expect(caller.verifyMfa({ code: "654321" })).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
    } finally {
      ENV.isProduction = production;
      warn.mockRestore();
    }
  });

  it("allows the explicitly activated temporary production testing path", async () => {
    const production = ENV.isProduction;
    ENV.isProduction = true;
    vi.stubEnv("ADMIN_MFA_TRIAL_FALLBACK", "true");
    vi.stubEnv(
      "ADMIN_MFA_TRIAL_FALLBACK_UNTIL",
      new Date(Date.now() + 3600000).toISOString(),
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      mocks.smsRequest.mockRejectedValue(
        new TwilioVerificationDeliveryError(403, 21608),
      );
      const ctx = context();
      const caller = adminRouter.createCaller(ctx);
      const result = await caller.requestMfa();
      expect(result.fallback).toBe(true);
      expect(result.testCode).toBe("654321");
      expect(warn).not.toHaveBeenCalled();
      await caller.verifyMfa({ code: "654321" });
      expect(mocks.smsCheck).not.toHaveBeenCalled();
    } finally {
      ENV.isProduction = production;
      vi.unstubAllEnvs();
      warn.mockRestore();
    }
  });

  it("keeps production locked on 21608 unless recovery is explicitly enabled", async () => {
    const production = ENV.isProduction;
    ENV.isProduction = true;
    vi.stubEnv("ADMIN_MFA_TRIAL_FALLBACK", "false");
    try {
      mocks.smsRequest.mockRejectedValue(
        new TwilioVerificationDeliveryError(403, 21608),
      );
      const ctx = context();
      await expect(
        adminRouter.createCaller(ctx).requestMfa(),
      ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
      expect(ctx.req.cookies.appforge_admin_challenge).toBeUndefined();
    } finally {
      ENV.isProduction = production;
      vi.unstubAllEnvs();
    }
  });

  it("does not grant admin access when SMS delivery fails", async () => {
    mocks.smsRequest.mockRejectedValue(new Error("provider unavailable"));
    const ctx = context();
    await expect(
      adminRouter.createCaller(ctx).requestMfa(),
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(ctx.req.cookies.appforge_admin_challenge).toBeUndefined();
    await expect(adminRouter.createCaller(ctx).me()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

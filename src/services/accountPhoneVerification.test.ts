import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserById: vi.fn(),
  updateUserById: vi.fn(),
  request: vi.fn(),
  check: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: mocks } }),
}));
vi.mock("../_core/env.js", () => ({
  ENV: {
    supabaseUrl: "https://identity.example.com",
    supabaseServiceKey: "test-key",
  },
}));
vi.mock("../lib/twilioSms.js", () => ({
  requestTwilioVerification: mocks.request,
  checkTwilioVerification: mocks.check,
}));
import {
  requestAccountPhoneVerification,
  verifyAccountPhone,
} from "./accountPhoneVerification.js";

const phone = "+15551234567";
describe("account phone challenges", () => {
  beforeEach(() => {
    mocks.updateUserById.mockResolvedValue({ error: null });
    mocks.check.mockResolvedValue(true);
    mocks.request.mockResolvedValue(undefined);
  });

  it("stores the challenge target in server-controlled metadata", async () => {
    mocks.getUserById.mockResolvedValue({
      data: {
        user: {
          user_metadata: { signup_phone: phone },
          app_metadata: { provider: "email" },
        },
      },
      error: null,
    });
    await requestAccountPhoneVerification({ supabaseUid: "user-1" });
    expect(mocks.updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          provider: "email",
          pending_phone: phone,
          pending_phone_requested_at: expect.any(Number),
        }),
      }),
    );
    expect(mocks.request).toHaveBeenCalledWith(phone);
  });

  it("requires a challenge requested for this account before checking a code", async () => {
    mocks.getUserById.mockResolvedValue({
      data: { user: { user_metadata: { signup_phone: phone } } },
      error: null,
    });
    await expect(
      verifyAccountPhone({ supabaseUid: "user-1", code: "123456" }),
    ).rejects.toThrow(/request.*code/i);
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it("ignores browser edits to the number after the SMS challenge was issued", async () => {
    mocks.getUserById.mockResolvedValue({
      data: {
        user: {
          user_metadata: { signup_phone: "+15557654321" },
          app_metadata: {
            pending_phone: phone,
            pending_phone_requested_at: Date.now(),
          },
        },
      },
      error: null,
    });
    await expect(
      verifyAccountPhone({ supabaseUid: "user-1", code: "123456" }),
    ).resolves.toBe(true);
    expect(mocks.check).toHaveBeenCalledWith(phone, "123456");
    expect(mocks.updateUserById).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        phone,
        phone_confirm: true,
        app_metadata: expect.objectContaining({
          pending_phone: null,
          pending_phone_requested_at: null,
        }),
      }),
    );
  });

  it("rejects expired challenges without contacting the SMS provider", async () => {
    mocks.getUserById.mockResolvedValue({
      data: {
        user: {
          user_metadata: { signup_phone: phone },
          app_metadata: {
            pending_phone: phone,
            pending_phone_requested_at: Date.now() - 11 * 60_000,
          },
        },
      },
      error: null,
    });
    await expect(
      verifyAccountPhone({ supabaseUid: "user-1", code: "123456" }),
    ).rejects.toThrow(/request.*code/i);
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it("accepts valid provider-configured four-digit SMS codes", async () => {
    mocks.getUserById.mockResolvedValue({
      data: {
        user: {
          app_metadata: {
            pending_phone: phone,
            pending_phone_requested_at: Date.now(),
          },
        },
      },
      error: null,
    });
    await expect(
      verifyAccountPhone({ supabaseUid: "user-1", code: "4321" }),
    ).resolves.toBe(true);
    expect(mocks.check).toHaveBeenCalledWith(phone, "4321");
  });

  it("rejects malformed or overly long OTPs without contacting Twilio", async () => {
    mocks.check.mockClear();
    await expect(
      verifyAccountPhone({ supabaseUid: "user-1", code: "12345678901" }),
    ).resolves.toBe(false);
    await expect(
      verifyAccountPhone({ supabaseUid: "user-1", code: "12ab" }),
    ).resolves.toBe(false);
    expect(mocks.check).not.toHaveBeenCalled();
  });

  it("does not confirm an invalid OTP", async () => {
    mocks.getUserById.mockResolvedValue({
      data: {
        user: {
          app_metadata: {
            pending_phone: phone,
            pending_phone_requested_at: Date.now(),
          },
        },
      },
      error: null,
    });
    mocks.check.mockResolvedValue(false);
    await expect(
      verifyAccountPhone({ supabaseUid: "user-1", code: "000000" }),
    ).resolves.toBe(false);
    expect(mocks.updateUserById).not.toHaveBeenCalled();
  });
});

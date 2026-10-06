import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      signInWithOtp: mocks.signInWithOtp,
      verifyOtp: mocks.verifyOtp,
      signOut: mocks.signOut,
    },
  },
}));

import {
  getCurrentSession,
  logout,
  sendPhoneOtp,
  verifyPhoneOtp,
} from "../auth";

describe("customer phone authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("requests an SMS OTP through Supabase using E.164 phone numbers", async () => {
    mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await sendPhoneOtp("+15551234567");
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({ phone: "+15551234567" });
  });

  it("rejects non-E.164 phone numbers before requesting an OTP", async () => {
    await expect(sendPhoneOtp("5551234567")).rejects.toThrow(/E\.164/i);
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });

  it("verifies an SMS OTP through Supabase and stores the AppForge session", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {
        session: {
          access_token: "access",
          refresh_token: "refresh",
          user: { id: "user-1", phone: "+15551234567" },
        },
      },
      error: null,
    });

    const result = await verifyPhoneOtp("+15551234567", "123456");

    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      phone: "+15551234567",
      token: "123456",
      type: "sms",
    });
    expect(result.session?.user.id).toBe("user-1");
    expect(localStorage.setItem).toHaveBeenCalledWith(
      "appforge.user",
      JSON.stringify({ id: "user-1", phone: "+15551234567" }),
    );
    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      "appforge.access-token",
      "access",
    );
  });

  it("returns the current AppForge session backed by the Supabase identity", async () => {
    vi.mocked(localStorage.getItem).mockImplementation((key: string) =>
      key === "appforge.user"
        ? JSON.stringify({ id: "user-1", phone: "+15551234567" })
        : null,
    );
    vi.mocked(sessionStorage.getItem).mockImplementation((key: string) =>
      key === "appforge.access-token" ? "access" : null,
    );

    await expect(getCurrentSession()).resolves.toEqual({
      accessToken: "access",
      user: { id: "user-1", phone: "+15551234567" },
    });
  });

  it("logs out through Supabase", async () => {
    mocks.signOut.mockResolvedValue({ error: null });
    await logout();
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });
});

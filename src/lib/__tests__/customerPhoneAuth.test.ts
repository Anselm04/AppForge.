import { beforeEach, describe, expect, it, vi } from "vitest";

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();
const signOut = vi.fn();

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      signInWithOtp,
      verifyOtp,
      signOut,
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
    signInWithOtp.mockResolvedValue({ data: {}, error: null });

    await sendPhoneOtp("+64221234567");

    expect(signInWithOtp).toHaveBeenCalledWith({ phone: "+64221234567" });
  });

  it("rejects non-E.164 phone numbers before requesting an OTP", async () => {
    await expect(sendPhoneOtp("0221234567")).rejects.toThrow(/E\.164/i);
    expect(signInWithOtp).not.toHaveBeenCalled();
  });

  it("verifies a six-digit SMS OTP through Supabase", async () => {
    verifyOtp.mockResolvedValue({
      data: {
        session: {
          access_token: "access",
          refresh_token: "refresh",
          user: { id: "user-1", phone: "+64221234567" },
        },
      },
      error: null,
    });

    const result = await verifyPhoneOtp("+64221234567", "123456");

    expect(verifyOtp).toHaveBeenCalledWith({
      phone: "+64221234567",
      token: "123456",
      type: "sms",
    });
    expect(result.session?.user.id).toBe("user-1");
    expect(JSON.parse(localStorage.getItem("appforge.user") ?? "{}")).toEqual({
      id: "user-1",
      phone: "+64221234567",
    });
    expect(sessionStorage.getItem("appforge.access-token")).toBe("access");
  });

  it("returns the current AppForge session backed by the Supabase identity", async () => {
    localStorage.setItem(
      "appforge.user",
      JSON.stringify({ id: "user-1", phone: "+64221234567" }),
    );
    sessionStorage.setItem("appforge.access-token", "access");

    await expect(getCurrentSession()).resolves.toEqual({
      accessToken: "access",
      user: { id: "user-1", phone: "+64221234567" },
    });
  });

  it("logs out through Supabase", async () => {
    signOut.mockResolvedValue({ error: null });

    await logout();

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

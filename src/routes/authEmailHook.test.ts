import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
const send = vi.hoisted(() => vi.fn());
vi.mock("../services/twilioEmail.js", () => ({
  sendTwilioEmail: send,
  requireTwilioEmailConfig: vi.fn(),
}));
import { authEmailHookHandler } from "./authEmailHook.js";
const key = Buffer.alloc(32, 1);
describe("signed Supabase to Twilio email hook", () => {
  beforeEach(() => {
    vi.stubEnv(
      "SUPABASE_SEND_EMAIL_HOOK_SECRET",
      `v1,whsec_${key.toString("base64")}`,
    );
    vi.stubEnv("PUBLIC_APP_URL", "https://app.example.com");
    send.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());
  async function invoke(
    event: object,
    options: { signed?: boolean; age?: number; tamper?: boolean } = {},
  ) {
    const body = JSON.stringify(event);
    const id = "hook-event-1";
    const timestamp = String(
      Math.floor(Date.now() / 1000) - (options.age ?? 0),
    );
    const signature = createHmac("sha256", key)
      .update(`${id}.${timestamp}.${body}`)
      .digest("base64");
    const headers: Record<string, string> = {
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature":
        options.signed === false ? "v1,invalid" : `v1,${signature}`,
    };
    const req = {
      body: Buffer.from(options.tamper ? body + " " : body),
      get: (name: string) => headers[name],
    } as unknown as Request;
    const res = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    await authEmailHookHandler(req, res as unknown as Response, vi.fn());
    return res;
  }
  const signup = {
    user: { email: "customer@example.com" },
    email_data: {
      email_action_type: "signup",
      token_hash: "signup-hash",
      redirect_to: "https://attacker.example.com",
    },
  };
  it.each([{ signed: false }, { age: 601 }, { tamper: true }])(
    "rejects forged, expired or altered payloads before sending email",
    async (options) => {
      const res = await invoke(signup, options);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(send).not.toHaveBeenCalled();
    },
  );
  it("routes a genuine confirmation to Twilio using only the trusted app origin", async () => {
    const res = await invoke(signup);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "customer@example.com",
        text: expect.stringContaining("https://app.example.com/login?"),
      }),
    );
    expect(JSON.stringify(send.mock.calls)).not.toContain(
      "attacker.example.com",
    );
  });
  it("delivers password-change verification as an OTP", async () => {
    await invoke({
      user: { email: "customer@example.com" },
      email_data: { email_action_type: "reauthentication", token: "123456" },
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ text: expect.stringContaining("123456") }),
    );
  });
  it("requires both current and new email approvals for secure email change", async () => {
    await invoke({
      user: { email: "current@example.com", new_email: "new@example.com" },
      email_data: {
        email_action_type: "email_change",
        token_hash: "new-email-hash",
        token_hash_new: "current-email-hash",
      },
    });
    expect(send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: "current@example.com",
        text: expect.stringContaining("token_hash=current-email-hash"),
      }),
    );
    expect(send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: "new@example.com",
        text: expect.stringContaining("token_hash=new-email-hash"),
      }),
    );
  });
  it("does not acknowledge a failed delivery", async () => {
    send.mockRejectedValue(new Error("provider failure"));
    const res = await invoke(signup);
    expect(res.status).toHaveBeenCalledWith(503);
  });
});

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  signUp: vi.fn(),
  resend: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: sdk }),
}));
vi.mock("../_core/env.js", () => ({
  ENV: { supabaseUrl: "http://127.0.0.1:54321" },
}));

import { supabaseClient } from "../lib/supabase-client.js";
import {
  createSignupConfirmation,
  resendSignupConfirmation,
  sendPasswordRecovery,
} from "../services/authEmailDelivery.js";

/**
 * Local GoTrue HTTP-contract mock; no real service, email, keys or login tokens.
 * The mock is deliberately not evidence of Supabase hosted delivery or RLS.
 */
// prettier-ignore
describe("customer GoTrue lifecycle over local in-memory HTTP mock", () => {
  let verified = false;
  let password = "InitialPassword123!";
  let active = new Set<string>();
  let tokenCounter = 0;
  const email = "maker@example.test";
  const uid = "fixture-user-101";

  beforeEach(() => {
    verified = false;
    password = "InitialPassword123!";
    active = new Set<string>();
    tokenCounter = 0;
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public-local-fixture");
    Object.assign(window, {
      __APPFORGE_CONFIG__: {
        supabaseUrl: "http://127.0.0.1:54321",
        supabasePublishableKey: "public-local-fixture",
      },
    });
    sdk.signUp.mockReset().mockImplementation(async ({ email: supplied }: { email: string }) => ({
      data: { user: { id: uid, email: supplied }, session: null },
      error: null,
    }));
    sdk.resend.mockReset().mockResolvedValue({ error: null });
    sdk.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const url = String(input);
      const body = init.body ? JSON.parse(String(init.body)) : {};
      const headers = new Headers(init.headers);
      const authorized = headers.get("authorization")?.replace(/^Bearer /, "");
      const json = (status: number, value: object) =>
        new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
      if (url.endsWith("/auth/v1/verify")) {
        if (body.token_hash !== "signed-fixture-confirmation" || body.type !== "signup") {
          return json(403, { message: "Invalid or expired token" });
        }
        verified = true;
        return json(200, { user: { id: uid, email } });
      }
      if (url.includes("/auth/v1/token?grant_type=password")) {
        if (!verified || body.email !== email || body.password !== password) {
          return json(400, { message: "Invalid login credentials" });
        }
        const access_token = `fixture-session-${++tokenCounter}`;
        active.add(access_token);
        return json(200, { access_token, user: { id: uid, email } });
      }
      if (url.endsWith("/auth/v1/user") && (init.method ?? "GET") === "GET") {
        return authorized && active.has(authorized)
          ? json(200, { id: uid, email })
          : json(401, { message: "Invalid session" });
      }
      if (url.endsWith("/auth/v1/user") && init.method === "PUT") {
        if (!authorized || !active.has(authorized)) return json(401, { message: "Invalid session" });
        if (typeof body.password !== "string" || body.password.length < 12) {
          return json(400, { message: "Password does not meet policy" });
        }
        password = body.password;
        return json(200, { user: { id: uid, email } });
      }
      if (url.includes("/auth/v1/logout?scope=local")) {
        if (!authorized || !active.delete(authorized)) return json(401, { message: "Invalid session" });
        return json(200, {});
      }
      throw new Error(`Unexpected non-local GoTrue request: ${url}`);
    }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    delete window.__APPFORGE_CONFIG__;
  });

  it("registers pending identity, refuses login until email verification and rejects forged confirmation", async () => {
    await expect(createSignupConfirmation({
      email, phone: "", password,
      redirectTo: "http://127.0.0.1:3000/login",
    })).resolves.toEqual({ userId: uid, confirmationSent: true });
    expect(sdk.signUp).toHaveBeenCalledTimes(1);
    await expect(supabaseClient.signIn(email, password)).rejects.toThrow(/Invalid login/);
    await expect(supabaseClient.verifyEmailTokenHash("forged", "signup"))
      .rejects.toThrow(/Invalid or expired/);
    await expect(supabaseClient.verifyEmailTokenHash("signed-fixture-confirmation", "signup"))
      .resolves.toMatchObject({ user: { id: uid } });
    expect((await supabaseClient.signIn(email, password)).user?.id).toBe(uid);
  });

  it("logs out one session and refuses reuse of its bearer token", async () => {
    await supabaseClient.verifyEmailTokenHash("signed-fixture-confirmation", "signup");
    const login = await supabaseClient.signIn(email, password);
    expect(await supabaseClient.getVerifiedUser(login.access_token!)).toMatchObject({ id: uid });
    await supabaseClient.signOut(login.access_token!);
    await expect(supabaseClient.getVerifiedUser(login.access_token!))
      .rejects.toThrow(/Invalid session/);
  });

  it("resends verification for the same account and requests a non-enumerating recovery message", async () => {
    await resendSignupConfirmation({ email, redirectTo: "http://127.0.0.1:3000/login" });
    expect(sdk.resend).toHaveBeenCalledWith(expect.objectContaining({ email, type: "signup" }));
    await sendPasswordRecovery({ email, redirectTo: "http://127.0.0.1:3000/reset-password" });
    expect(sdk.resetPasswordForEmail).toHaveBeenCalledWith(email, {
      redirectTo: "http://127.0.0.1:3000/reset-password",
    });
  });

  it("allows password reset only with a verified recovery session, invalidating old password", async () => {
    await supabaseClient.verifyEmailTokenHash("signed-fixture-confirmation", "signup");
    await sendPasswordRecovery({ email, redirectTo: "http://127.0.0.1:3000/reset-password" });
    await expect(supabaseClient.updatePassword("forged", "ReplacementPassword123!"))
      .rejects.toThrow(/Invalid session/);
    const originalPassword = password;
    const recovered = await supabaseClient.signIn(email, password);
    await supabaseClient.updatePassword(recovered.access_token!, "ReplacementPassword123!");
    await supabaseClient.signOut(recovered.access_token!);
    await expect(supabaseClient.signIn(email, originalPassword)).rejects.toThrow(/Invalid login/);
    await expect(supabaseClient.signIn(email, "ReplacementPassword123!"))
      .resolves.toMatchObject({ user: { id: uid } });
  });
});

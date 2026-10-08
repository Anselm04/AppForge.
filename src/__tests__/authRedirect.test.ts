import { afterEach, describe, expect, it, vi } from "vitest";
import { signupRedirect } from "../services/authRedirect.js";

afterEach(() => vi.unstubAllEnvs());

describe("trusted signup confirmation redirects", () => {
  it("uses the configured origin and encodes the intended destination", () => {
    vi.stubEnv("PUBLIC_APP_URL", "https://app.example.com/path?ignored=1");
    expect(signupRedirect("/account?tab=profile")).toBe(
      "https://app.example.com/login?next=%2Faccount%3Ftab%3Dprofile",
    );
  });

  it("fails closed without a configured origin", () => {
    vi.stubEnv("PUBLIC_APP_URL", "");
    vi.stubEnv("APP_URL", "");
    expect(() => signupRedirect("/")).toThrow("trusted signup origin");
  });

  it.each([
    "http://app.example.com",
    "https://user:secret@app.example.com",
    "javascript:alert(1)",
  ])("rejects unsafe production origin %s", (origin) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PUBLIC_APP_URL", origin);
    expect(() => signupRedirect("/")).toThrow();
  });
});

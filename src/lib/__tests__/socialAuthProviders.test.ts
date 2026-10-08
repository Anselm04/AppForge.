import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SOCIAL_SIGN_IN_PROVIDERS,
  supabaseClient,
} from "../supabase-client.js";
import { safeAuthDestination } from "../auth.js";

const SUPABASE_URL = "https://project.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_test_key";

const fetchMock = () => globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

function mockSettings(external: Record<string, boolean>, status = 200) {
  fetchMock().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ external }),
  });
}

beforeEach(() => {
  window.__APPFORGE_CONFIG__ = {
    supabaseUrl: SUPABASE_URL,
    supabasePublishableKey: PUBLISHABLE_KEY,
  };
});

describe("social sign-in provider discovery", () => {
  it("is pinned to the providers AppForge actually supports", () => {
    expect([...SOCIAL_SIGN_IN_PROVIDERS]).toEqual(["google", "github"]);
  });

  it("offers only the providers Supabase reports as enabled", async () => {
    mockSettings({ google: true, github: true });

    await expect(supabaseClient.listAuthProviders()).resolves.toEqual([
      "google",
      "github",
    ]);
  });

  it("hides a provider the project has not enabled", async () => {
    mockSettings({ google: true, github: false, email: true });

    await expect(supabaseClient.listAuthProviders()).resolves.toEqual([
      "google",
    ]);
  });

  it("reads project settings with the publishable key", async () => {
    mockSettings({ google: true });

    await supabaseClient.listAuthProviders();

    const [url, init] = fetchMock().mock.calls[0];
    expect(String(url)).toBe(`${SUPABASE_URL}/auth/v1/settings`);
    expect((init as RequestInit).headers).toMatchObject({
      apikey: PUBLISHABLE_KEY,
    });
  });

  it("fails closed when the settings endpoint errors", async () => {
    mockSettings({ google: true, github: true }, 500);

    await expect(supabaseClient.listAuthProviders()).resolves.toEqual([]);
  });

  it("fails closed when the settings request cannot be made", async () => {
    fetchMock().mockRejectedValueOnce(new Error("network down"));

    await expect(supabaseClient.listAuthProviders()).resolves.toEqual([]);
  });

  it("builds an authorize URL carrying the provider and return path", () => {
    const url = supabaseClient.oauthAuthorizeUrl(
      "github",
      "https://app.example.com/login?next=%2Fadmin",
    );

    expect(url.startsWith(`${SUPABASE_URL}/auth/v1/authorize?`)).toBe(true);
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("provider")).toBe("github");
    expect(params.get("redirect_to")).toBe(
      "https://app.example.com/login?next=%2Fadmin",
    );
  });
});

describe("post-sign-in destination guard", () => {
  it("keeps same-origin app paths", () => {
    expect(safeAuthDestination("/admin")).toBe("/admin");
    expect(safeAuthDestination("/app/new?template=saas")).toBe(
      "/app/new?template=saas",
    );
  });

  it("rejects destinations that would leave the app", () => {
    expect(safeAuthDestination("//evil.example.com")).toBe("/");
    expect(safeAuthDestination("https://evil.example.com")).toBe("/");
    expect(safeAuthDestination("/\\evil.example.com")).toBe("/");
    expect(safeAuthDestination("javascript:alert(1)")).toBe("/");
    expect(safeAuthDestination("admin")).toBe("/");
    expect(safeAuthDestination(null)).toBe("/");
    expect(safeAuthDestination("")).toBe("/");
  });

  it("honours a caller-supplied fallback", () => {
    expect(safeAuthDestination(null, "/dashboard")).toBe("/dashboard");
    expect(safeAuthDestination("//evil.example.com", "/dashboard")).toBe(
      "/dashboard",
    );
  });
});

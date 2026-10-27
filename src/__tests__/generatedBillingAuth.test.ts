import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { billingSessionModule } from "../lib/billingScaffoldTemplates.js";
function emittedModule() {
  const code = ts.transpileModule(billingSessionModule(), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const module = {
    exports: {} as {
      getUserIdFromRequest: (req: unknown) => Promise<string | null>;
    },
  };
  new Function("module", "exports", code)(module, module.exports);
  return module.exports;
}
beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://auth.example.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fixture-public-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("authentication emitted into generated paid products", () => {
  it("rejects a caller-selected userId cookie instead of exposing another customer billing", async () => {
    const session = emittedModule();
    expect(
      await session.getUserIdFromRequest({
        headers: { cookie: "userId=victim" },
      }),
    ).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("uses the auth provider verified identity rather than request metadata", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: "verified-user" }), {
            status: 200,
          }),
      ),
    );
    const session = emittedModule();
    expect(
      await session.getUserIdFromRequest({
        headers: {
          authorization: "Bearer fixture-token",
          cookie: "userId=victim",
        },
      }),
    ).toBe("verified-user");
    expect(fetch).toHaveBeenCalledWith(
      "https://auth.example.test/auth/v1/user",
      expect.objectContaining({
        headers: {
          authorization: "Bearer fixture-token",
          apikey: "fixture-public-key",
        },
        redirect: "error",
      }),
    );
  });
  it("supports Next headers and a verified access-token cookie", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ id: "verified-user" }), {
            status: 200,
          }),
      ),
    );
    const session = emittedModule();
    expect(
      await session.getUserIdFromRequest({
        headers: new Headers({ cookie: "sb-access-token=fixture-token" }),
      }),
    ).toBe("verified-user");
  });
  it("fails closed when authentication configuration or provider verification is unavailable", async () => {
    const session = emittedModule();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    expect(
      await session.getUserIdFromRequest({
        headers: { authorization: "Bearer invalid" },
      }),
    ).toBeNull();
    vi.stubEnv("SUPABASE_URL", "https://attacker:secret@auth.example.test");
    expect(
      await session.getUserIdFromRequest({
        headers: { authorization: "Bearer invalid" },
      }),
    ).toBeNull();
    vi.stubEnv("SUPABASE_URL", "");
    expect(
      await session.getUserIdFromRequest({
        headers: { authorization: "Bearer invalid" },
      }),
    ).toBeNull();
  });
  it("handles malformed cookies without crashing the generated product", async () => {
    const session = emittedModule();
    expect(
      await session.getUserIdFromRequest({
        headers: { cookie: "sb-access-token=%invalid" },
      }),
    ).toBeNull();
  });
});

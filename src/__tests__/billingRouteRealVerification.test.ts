import { afterEach, describe, expect, it, vi } from "vitest";
import { runBillingRouteSmokeTest } from "../services/deployHealth.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function installBillingFetch(override: Record<string, Response>) {
  const fetcher = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    return (
      override[path] ??
      new Response('{"message":"Missing or invalid credentials"}', {
        status: 401,
        headers: { "content-type": "application/json" },
      })
    );
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

describe("real billing-route verification", () => {
  it("rejects SPA HTML fallback pages for checkout, webhook and account routes", async () => {
    const html = new Response("<html><body>Welcome to the SPA</body></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    installBillingFetch({
      "/pricing": new Response("<html>Real pricing page</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
      "/api/checkout": html,
      "/api/webhooks/stripe": html.clone(),
      "/api/billing/me": html.clone(),
    });
    const result = await runBillingRouteSmokeTest("https://test.vercel.app");
    expect(result.ok).toBe(false);
    expect(result.routes[0]?.ok).toBe(true);
    for (const route of result.routes.slice(1)) {
      expect(route.ok).toBe(false);
      expect(route.note).toContain("HTML fallback");
    }
  });

  it("recognizes real route handlers rejecting unsigned and unauthorized requests", async () => {
    const fetcher = installBillingFetch({
      "/pricing": new Response("<html><body>Pricing</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
      "/api/checkout": new Response('{"error":"auth required"}', {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
      "/api/webhooks/stripe": new Response("Invalid Stripe signature", {
        status: 400,
        headers: { "content-type": "text/plain" },
      }),
      "/api/billing/me": new Response('{"error":"forbidden"}', {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    });
    const result = await runBillingRouteSmokeTest("https://test.vercel.app");
    expect(result.ok).toBe(true);
    expect(result.routes).toHaveLength(4);
    expect(fetcher).toHaveBeenCalledTimes(4);
    for (const call of fetcher.mock.calls) {
      expect(call[1]?.redirect).toBe("manual");
    }
    expect(result.routes[1]?.note).toContain("not verified");
  });

  it("does not count redirects or infrastructure failures as working billing routes", async () => {
    installBillingFetch({
      "/pricing": new Response("Redirect", {
        status: 302,
        headers: { location: "/login" },
      }),
      "/api/checkout": new Response("Not found", { status: 404 }),
      "/api/webhooks/stripe": new Response("Unavailable", { status: 503 }),
      "/api/billing/me": new Response("Gateway failure", { status: 502 }),
    });
    const result = await runBillingRouteSmokeTest("https://test.vercel.app");
    expect(result.ok).toBe(false);
    expect(result.routes.every((route) => !route.ok)).toBe(true);
  });

  it("does not accept a 200 HTML generic billing health response", async () => {
    installBillingFetch({
      "/pricing": new Response("Real pricing", { status: 200 }),
      "/api/checkout": new Response("<h1>Home</h1>", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    });
    const result = await runBillingRouteSmokeTest("https://test.vercel.app");
    expect(
      result.routes.find((route) => route.path === "/api/checkout")?.ok,
    ).toBe(false);
  });
});

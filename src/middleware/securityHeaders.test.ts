import { describe, expect, it, vi } from "vitest";
import {
  additionalSecurityHeaders,
  shouldPreventCaching,
} from "./securityHeaders.js";

describe("sensitive response cache policy", () => {
  it("covers API and auth roots as well as nested routes", () => {
    expect(shouldPreventCaching("/api")).toBe(true);
    expect(shouldPreventCaching("/api/billing")).toBe(true);
    expect(shouldPreventCaching("/auth")).toBe(true);
    expect(shouldPreventCaching("/auth/callback")).toBe(true);
    expect(shouldPreventCaching("/")).toBe(false);
    expect(shouldPreventCaching("/pricing")).toBe(false);
  });

  it("sets no-store and defensive headers for API responses", () => {
    const headers = new Map<string, string>();
    const removed: string[] = [];
    const next = vi.fn();
    const req = { path: "/api/billing" } as any;
    const res = {
      setHeader: (name: string, value: string) => headers.set(name, value),
      removeHeader: (name: string) => removed.push(name),
    } as any;

    additionalSecurityHeaders()(req, res, next);

    expect(headers.get("Cache-Control")).toBe(
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    expect(headers.get("Pragma")).toBe("no-cache");
    expect(headers.get("Expires")).toBe("0");
    expect(headers.get("X-DNS-Prefetch-Control")).toBe("off");
    expect(headers.get("X-Permitted-Cross-Domain-Policies")).toBe("none");
    expect(removed).toEqual(expect.arrayContaining(["X-Powered-By", "Server"]));
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not disable caching for public page routes", () => {
    const headers = new Map<string, string>();
    const next = vi.fn();
    const req = { path: "/pricing" } as any;
    const res = {
      setHeader: (name: string, value: string) => headers.set(name, value),
      removeHeader: vi.fn(),
    } as any;

    additionalSecurityHeaders()(req, res, next);

    expect(headers.has("Cache-Control")).toBe(false);
    expect(headers.has("Pragma")).toBe(false);
    expect(headers.has("Expires")).toBe(false);
    expect(next).toHaveBeenCalledOnce();
  });
});

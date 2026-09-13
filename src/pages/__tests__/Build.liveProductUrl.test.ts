import { describe, expect, it } from "vitest";
import { normalizeLiveProductUrl } from "../Build.js";

describe("Build live product handoff", () => {
  it("accepts verified HTTPS product URLs", () => {
    expect(normalizeLiveProductUrl("https://af-example.fly.dev")).toBe(
      "https://af-example.fly.dev/",
    );
  });

  it("rejects non-HTTPS and relative URLs", () => {
    expect(normalizeLiveProductUrl("http://example.com")).toBeNull();
    expect(normalizeLiveProductUrl("/apps/123")).toBeNull();
    expect(normalizeLiveProductUrl("javascript:alert(1)")).toBeNull();
  });
});

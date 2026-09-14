import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const orgs = readFileSync(
  resolve(process.cwd(), "src/routers/orgs.ts"),
  "utf8",
);

describe("enterprise organization slug validation", () => {
  it("normalizes organization slugs through one guarded path", () => {
    expect(orgs).toContain("export function normalizeOrganizationSlug");
    expect(orgs).toContain("ORGANIZATION_SLUG_PATTERN");
    expect(orgs).toContain(
      "const slug = normalizeOrganizationSlug(input.name, input.slug);",
    );
  });

  it("rejects names that cannot produce a safe usable slug", () => {
    expect(orgs).toContain("slug.length < 2");
    expect(orgs).toContain('code: "BAD_REQUEST"');
    expect(orgs).toContain(
      "Organization name must produce a URL-safe slug with at least two letters or numbers.",
    );
  });
});

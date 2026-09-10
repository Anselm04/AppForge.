import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");
const health = readFileSync(resolve(root, "src/routes/health.ts"), "utf8");
const deploy = readFileSync(
  resolve(root, ".github/workflows/deploy-production.yml"),
  "utf8",
);

describe("production release traceability", () => {
  it("bakes the immutable Git revision into the production image", () => {
    expect(dockerfile).toContain("ARG APPFORGE_RELEASE_SHA=unknown");
    expect(dockerfile).toContain("ENV APPFORGE_RELEASE_SHA=$APPFORGE_RELEASE_SHA");
    expect(dockerfile).toContain("ENV SENTRY_RELEASE=$APPFORGE_RELEASE_SHA");
  });

  it("reports a sanitized revision from health endpoints", () => {
    expect(health).toContain("function releaseRevision()");
    expect(health).toContain("/^[0-9a-f]{7,40}$/i");
    expect(health).toContain("revision: releaseRevision()");
  });

  it("fails deployment unless Fly serves the exact GitHub SHA", () => {
    expect(deploy).toContain('--build-arg APPFORGE_RELEASE_SHA="$GITHUB_SHA"');
    expect(deploy).toContain('grep -q "\\\"revision\\\":\\\"$GITHUB_SHA\\\""');
    expect(deploy).toContain("Production readiness and exact revision check passed");
  });
});

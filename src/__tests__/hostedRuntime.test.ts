import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("hosted product runtime", () => {
  it("uses only the validated artifact and isolated preview runtime", () => {
    const route = readFileSync("src/routes/hostedApps.ts", "utf8");

    expect(existsSync("src/lib/hostedRuntime.ts")).toBe(false);
    expect(route).toContain("getCurrentArtifact(projectId)");
    expect(route).toContain("ensureIsolatedPreview");
    expect(route).toContain('stackAdapter.generationMode === "structural"');
    expect(route).not.toContain("materializeHostedHtml");
  });
});

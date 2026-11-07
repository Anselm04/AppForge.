import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HOSTED_MIME } from "../lib/hostedRuntime.js";

describe("hosted artifact serving", () => {
  it("provides MIME types for files from validated generated artifacts", () => {
    expect(HOSTED_MIME[".html"]).toContain("text/html");
    expect(HOSTED_MIME[".js"]).toContain("text/javascript");
    expect(HOSTED_MIME[".css"]).toContain("text/css");
  });

  it("does not replace generated products with canned local-only substitutes", () => {
    const hosted = readFileSync(
      resolve(process.cwd(), "src/routes/hostedApps.ts"),
      "utf8",
    );
    const mime = readFileSync(
      resolve(process.cwd(), "src/lib/hostedRuntime.ts"),
      "utf8",
    );
    expect(hosted).toContain("getCurrentArtifact");
    expect(hosted).toContain("ensureIsolatedPreview");
    expect(hosted).not.toContain("materializeHostedHtml");
    expect(mime).not.toMatch(/fake agent|localStorage|waitlist|function agentPage|function websitePage/);
  });
});

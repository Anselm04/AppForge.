import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  joinIsolatedPreviewUrl,
  validateIsolatedPreviewUrl,
} from "../services/previewRuntime.js";

describe("#14 preview system", () => {
  it("only accepts trusted isolated preview hosts", () => {
    expect(
      validateIsolatedPreviewUrl(
        "https://customer-preview.sprites.app/",
        "https://runner.sprites.app/api/preview",
      ),
    ).toBe("https://customer-preview.sprites.app");

    expect(() =>
      validateIsolatedPreviewUrl(
        "https://evil.example/preview",
        "https://runner.sprites.app/api/preview",
      ),
    ).toThrow(/Untrusted isolated preview host/);
  });

  it("joins runtime routes without forwarding AppForge query credentials", () => {
    expect(
      joinIsolatedPreviewUrl(
        "https://customer-preview.sprites.app/base",
        "/dashboard/settings?sig=secret",
      ),
    ).toBe("https://customer-preview.sprites.app/base/dashboard/settings");
  });

  it("never substitutes the generic hosted shell for a runnable product", () => {
    const hosted = readFileSync("src/routes/hostedApps.ts", "utf8");
    expect(hosted).not.toContain("materializeHostedHtml");
    expect(hosted).toContain("ensureIsolatedPreview");
    expect(hosted).toContain("Structural output");
    expect(hosted).toContain("Runtime preview unavailable");
  });

  it("binds preview to the current snapshot and supports SPA route fallback", () => {
    const preview = readFileSync("src/routes/livePreview.ts", "utf8");
    expect(preview).toContain("await getCurrentArtifact(projectId)");
    expect(preview).toContain("X-AppForge-Snapshot-Id");
    expect(preview).toContain("looksLikeClientRoute");
    expect(preview).toContain("res.redirect(307, target.toString())");
    expect(preview).toContain('Cache-Control", "no-store"');
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const livePreview = readFileSync(
  resolve(process.cwd(), "src/routes/livePreview.ts"),
  "utf8",
);
const hostedApps = readFileSync(
  resolve(process.cwd(), "src/routes/hostedApps.ts"),
  "utf8",
);

const sandboxPolicy = "sandbox allow-scripts allow-forms allow-modals allow-popups";

describe("generated-app preview isolation", () => {
  it("keeps generated content on an opaque sandbox origin", () => {
    expect(livePreview).toContain(sandboxPolicy);
    expect(hostedApps).toContain(sandboxPolicy);
    expect(livePreview).not.toContain("sandbox allow-same-origin");
    expect(hostedApps).not.toContain("sandbox allow-same-origin");
  });

  it("prevents production from executing generated Vite builds in the AppForge process", () => {
    expect(livePreview).toContain(
      'if (process.env.NODE_ENV === "production") return null',
    );
  });

  it("rejects traversal paths before serving generated files", () => {
    expect(livePreview).toContain('parts.some((part) => part === "..")');
    expect(livePreview).toContain('error: "Invalid preview path"');
  });

  it("requires signed, explicitly public, or owner access for protected live previews", () => {
    expect(livePreview).toContain("verifyPreviewSignature(projectId, sig)");
    expect(livePreview).toContain("const ownerAccess = Boolean(");
    expect(livePreview).toContain("!signedAccess && !publicAccess && !ownerAccess");
  });

  it("prevents generated previews from leaking referrers or being cached", () => {
    for (const source of [livePreview, hostedApps]) {
      expect(source).toContain('res.setHeader("Cache-Control", "no-store")');
      expect(source).toContain('res.setHeader("Referrer-Policy", "no-referrer")');
    }
  });
});

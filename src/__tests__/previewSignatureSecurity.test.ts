import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  previewSignature,
  verifyPreviewSignature,
} from "../services/deployer.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

function clearSigningSecrets() {
  vi.stubEnv("PREVIEW_SECRET", "");
  vi.stubEnv("COOKIE_SECRET", "");
  vi.stubEnv("JWT_SECRET", "");
}

describe("signed preview authorization", () => {
  it("uses an unpredictable per-process secret for local previews instead of a public fallback", () => {
    clearSigningSecrets();
    vi.stubEnv("NODE_ENV", "development");
    const sig = previewSignature(42);
    expect(sig).toMatch(/^[0-9a-f]{32}$/);
    const publiclyKnownLegacySignature = createHmac(
      "sha256",
      "appforge-preview-dev",
    )
      .update("preview:42")
      .digest("hex")
      .slice(0, 32);
    expect(sig).not.toBe(publiclyKnownLegacySignature);
    expect(verifyPreviewSignature(42, publiclyKnownLegacySignature)).toBe(
      false,
    );
    expect(verifyPreviewSignature(42, sig)).toBe(true);
    expect(verifyPreviewSignature(43, sig)).toBe(false);
  });

  it("refuses to mint or authorize signed preview links without a production secret", () => {
    clearSigningSecrets();
    vi.stubEnv("NODE_ENV", "production");
    expect(() => previewSignature(42)).toThrow("Signed previews require");
    expect(verifyPreviewSignature(42, "0".repeat(32))).toBe(false);
  });

  it("authorizes only exact signatures for the matching project and configured key", () => {
    clearSigningSecrets();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PREVIEW_SECRET", "preview-test-secret-unique-to-this-suite");
    const sig = previewSignature(42);
    expect(verifyPreviewSignature(42, sig)).toBe(true);
    expect(verifyPreviewSignature(43, sig)).toBe(false);
    expect(verifyPreviewSignature(42, sig.toUpperCase())).toBe(false);
    expect(verifyPreviewSignature(42, sig + "0")).toBe(false);
    vi.stubEnv("PREVIEW_SECRET", "rotated-preview-test-secret");
    expect(verifyPreviewSignature(42, sig)).toBe(false);
  });
});

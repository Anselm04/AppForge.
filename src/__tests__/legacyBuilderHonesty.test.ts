import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("legacy builder never invents customer deployment success", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/services/app-builder.ts"),
    "utf8",
  );

  it("does not advertise a public preview or mark unverified code ready", () => {
    expect(src).toContain('previewUrl: ""');
    expect(src).toContain('deployUrl: ""');
    expect(src).toContain('status: "building"');
    expect(src).not.toContain('status: "ready",');
    expect(src).not.toContain("https://vercel.com/new?clone=1");
  });

  it("requires real integrated deployment, editing and export adapters", () => {
    expect(src).toContain(
      "App iteration requires a verified persisted project workflow.",
    );
    expect(src).toContain(
      "Deployment requires an authorised, verified deployment adapter.",
    );
    expect(src).toContain(
      "GitHub export requires an authorised repository integration.",
    );
  });
});

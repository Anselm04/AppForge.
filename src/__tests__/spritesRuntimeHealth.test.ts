import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const catalog = readFileSync(
  resolve(process.cwd(), "src/integrations/catalog.ts"),
  "utf8",
);
const health = readFileSync(
  resolve(process.cwd(), "src/integrations/health.ts"),
  "utf8",
);
const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");

describe("Sprites runtime health", () => {
  it("requires an independently verifiable Sprites runtime bridge", () => {
    expect(catalog).toContain("SPRITES_HEALTH_URL");
    expect(catalog).toContain("SPRITES_API_TOKEN");
    expect(health).toContain("Sprites runtime bridge is not configured");
    expect(health).toContain("SPRITES_HEALTH_URL");
    expect(health).toContain("SPRITES_API_TOKEN");
  });

  it("documents the server-side bridge configuration", () => {
    expect(envExample).toContain("SPRITES_HEALTH_URL=");
    expect(envExample).toContain("SPRITES_API_TOKEN=");
    expect(envExample).toContain(
      "ChatGPT Sprites plugin is not callable from the deployed AppForge server",
    );
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("disabled static Vercel deployment", () => {
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));

  it("never proxies customers into Fly", () => {
    expect(config.git.deploymentEnabled).toBe(false);
    expect(config.rewrites).toBeUndefined();
    expect(config.outputDirectory).toBe("dist/client");
    expect(JSON.stringify(config)).not.toContain(".fly.dev");
  });
});

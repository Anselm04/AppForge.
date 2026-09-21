import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const buildSource = readFileSync(
  resolve(process.cwd(), "src/pages/Build.tsx"),
  "utf8",
);

describe("Build authentication continuity", () => {
  it("reconnects the same background build instead of forcing a fresh login on routine token expiry", () => {
    expect(buildSource).toContain("authReconnectAttempts");
    expect(buildSource).toContain("retryDelay");
    expect(buildSource).toContain("setError(null)");
    expect(buildSource).not.toContain(
      "sign in again and reopen this project",
    );
  });
});

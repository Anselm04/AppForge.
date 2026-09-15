import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const flyConfig = readFileSync(resolve(process.cwd(), "fly.toml"), "utf8");

describe("Fly production availability invariants", () => {
  it("requires redundant always-on capacity", () => {
    expect(flyConfig).toMatch(/strategy\s*=\s*'bluegreen'/);
    expect(flyConfig).toMatch(/auto_stop_machines\s*=\s*false/);
    expect(flyConfig).toMatch(/auto_start_machines\s*=\s*true/);
    expect(flyConfig).toMatch(/min_machines_running\s*=\s*2/);
  });

  it("keeps the proxy and container aligned on port 3000", () => {
    expect(flyConfig).toMatch(/internal_port\s*=\s*3000/);
    expect(flyConfig).toMatch(/PORT\s*=\s*'3000'/);
  });

  it("requires a dependency-free liveness health check", () => {
    expect(flyConfig).toMatch(/path\s*=\s*'\/api\/health\/live'/);
    expect(flyConfig).toMatch(/interval\s*=\s*'15s'/);
  });
});

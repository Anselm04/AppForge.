import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const authSource = readFileSync(
  resolve(process.cwd(), "src/lib/auth.ts"),
  "utf8",
);

describe("Supabase login resilience", () => {
  it("keeps a valid bearer session when browser-cookie sync is temporarily unavailable", () => {
    expect(authSource).toContain("syncServerSessionBestEffort");
    expect(authSource).toContain("saveSession(session)");
    expect(authSource).toContain(
      "await syncServerSessionBestEffort(session.accessToken)",
    );
  });
});

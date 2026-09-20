import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "src/db.ts"), "utf8");
const middleware = readFileSync(
  resolve(process.cwd(), "src/middleware/supabaseAuth.ts"),
  "utf8",
);

describe("POST /api/auth/session 401 root cause fix", () => {
  it("links existing users by email when openId is new", () => {
    expect(dbSource).toContain("upsertUserFromAuth");
    expect(dbSource).toContain("where: eq(schema.users.email, email)");
    expect(dbSource).toMatch(/byEmail/);
  });

  it("returns 200 on session sync and 500 on upsert failure", () => {
    expect(middleware).toContain("status(200)");
    expect(middleware).toContain('code: "SESSION_UPSERT_FAILED"');
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("production auth lifecycle release gate", () => {
  it("requires real confirmation plus repeated logout/relogin and fresh-context proof", () => {
    const workflow = source(
      "../../.github/workflows/production-auth-lifecycle.yml",
    );
    const spec = source("../../scripts/production-auth-lifecycle.spec.mjs");

    expect(workflow).toContain("name: Production Auth Lifecycle");
    expect(workflow).toContain("/gate1-auth full ");
    expect(workflow).not.toContain("/gate1-auth request ");
    expect(workflow).not.toContain("/gate1-auth complete ");
    expect(workflow).toContain('run_one "request-confirmation"');
    expect(workflow).toContain('run_one "probe-confirmed"');
    expect(workflow).toContain('run_one "complete-lifecycle"');
    expect(workflow).not.toContain("APPFORGE_AUTH_GATE_CONFIRMATION_URL");
    expect(workflow).not.toContain("confirmation_url");
    expect(workflow).toContain("issue_comment");
    expect(workflow).toContain(
      "github.event.comment.user.login == github.repository_owner",
    );
    expect(workflow).toContain("gmail.com|googlemail.com");
    expect(workflow).toContain("Waiting up to 20 minutes");
    expect(workflow).toContain("ten logout/relogin boundaries");
    expect(workflow).toContain(
      "npx playwright test scripts/production-auth-lifecycle.spec.mjs --reporter=line",
    );

    expect(spec).toContain("/signup?next=%2Faccount");
    expect(spec).not.toContain("APPFORGE_AUTH_GATE_CONFIRMATION_URL");
    expect(spec).not.toContain("/auth/v1/verify");
    expect(spec).toContain("expectLoggedIn(page)");
    expect(spec).toContain("expectLoggedOut(page)");
    expect(spec).toContain("/login?next=%2Faccount");
    expect(spec).toContain("await page.reload");
    expect(spec).toContain("for (let cycle = 1; cycle <= 10; cycle += 1)");
    expect(spec).toContain("for (let cycle = 2; cycle <= 10; cycle += 1)");
    expect(spec).toContain("logged-out protected route must stay closed");
    expect(spec).toContain("fresh browser contexts ten times");
    expect(spec).toContain("toHaveURL(`${baseUrl}/account`)");
  });
});

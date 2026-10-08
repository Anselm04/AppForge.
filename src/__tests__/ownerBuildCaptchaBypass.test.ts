import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projects = readFileSync("src/routers/projects.ts", "utf8");
const home = readFileSync("src/pages/Home.tsx", "utf8");

describe("owner build start", () => {
  it("bypasses customer captcha for the authenticated owner", () => {
    expect(projects).toContain('import { isOwnerEmail } from "../lib/owner.js";');
    expect(projects).toContain("const owner = isOwnerEmail(ctx.user.email);");
    expect(projects).toContain("if (!owner) {");
    expect(projects).toContain("verifyHcaptchaToken(input.hcaptchaToken)");
  });

  it("does not render the customer captcha widget for the server-confirmed owner", () => {
    expect(home).toMatch(
      /\{!ownerUnlimited\s*&&\s*(?:\(\s*)?<HcaptchaWidget\s+onToken=\{setHcaptchaToken\}\s*\/>(?:\s*\))?\s*\}/,
    );
  });
});

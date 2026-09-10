import { describe, expect, it } from "vitest";
import {
  isSafeTemplateContent,
  isSafeTemplatePath,
  safeTemplateFiles,
} from "../routers/templateFactory.js";

describe("template factory secret filtering", () => {
  it("blocks credential and private-key file paths", () => {
    expect(isSafeTemplatePath(".env")).toBe(false);
    expect(isSafeTemplatePath("config/credentials.json")).toBe(false);
    expect(isSafeTemplatePath("certs/server.key")).toBe(false);
    expect(isSafeTemplatePath(".env.production")).toBe(false);
    expect(isSafeTemplatePath(".env.example")).toBe(true);
    expect(isSafeTemplatePath("src/index.ts")).toBe(true);
  });

  it("blocks known live-secret patterns while allowing placeholders", () => {
    expect(isSafeTemplateContent("STRIPE_SECRET_KEY=sk_live_1234567890abcdef")).toBe(false);
    expect(isSafeTemplateContent("GITHUB_TOKEN=github_pat_1234567890abcdef")).toBe(false);
    expect(
      isSafeTemplateContent(
        "-----BEGIN PRIVATE KEY-----\nvery-secret\n-----END PRIVATE KEY-----",
      ),
    ).toBe(false);
    expect(isSafeTemplateContent("STRIPE_SECRET_KEY=your-stripe-secret-key")).toBe(true);
    expect(isSafeTemplateContent("const title = 'AppForge';")).toBe(true);
  });

  it("removes unsafe files and unsafe content from template packages", () => {
    const safe = safeTemplateFiles({
      "src/index.ts": "export const app = true;",
      ".env": "OPENAI_API_KEY=real-secret-value-123456",
      "config/secrets.json": "{}",
      "README.md": "Safe documentation",
      "config.ts": "TWILIO_AUTH_TOKEN=real-auth-token-123456",
    });

    expect(Object.keys(safe).sort()).toEqual(["README.md", "src/index.ts"]);
  });
});

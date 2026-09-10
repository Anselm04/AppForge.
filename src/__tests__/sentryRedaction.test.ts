import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Sentry request redaction", () => {
  it("does not attach raw auth headers, cookies, or full URLs", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/middleware/sentryHandler.ts"),
      "utf8",
    );
    expect(source).not.toContain("headers: req.headers");
    expect(source).not.toContain("url: req.url");
    expect(source).toContain("[redacted]");
    expect(source).toContain('path: req.path');
  });
});

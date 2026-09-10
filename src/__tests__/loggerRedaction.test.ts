import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { logger } from "../_core/logger.js";

const errorReportingSource = readFileSync(
  resolve(process.cwd(), "src/utils/errorReporting.ts"),
  "utf8",
);

describe("structured logger redaction", () => {
  it("redacts nested credentials before writing logs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.error(
      {
        authorization: "Bearer top-secret",
        nested: {
          password: "hunter2",
          apiKey: "secret-key",
          safe: "visible",
        },
      },
      "redaction_test",
    );

    const output = spy.mock.calls.flat().join(" ");
    expect(output).not.toContain("top-secret");
    expect(output).not.toContain("hunter2");
    expect(output).not.toContain("secret-key");
    expect(output).toContain("[REDACTED]");
    expect(output).toContain("visible");

    spy.mockRestore();
  });

  it("redacts bearer tokens and key-value secrets embedded in strings", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.error("request failed authorization=Bearer abc.def.ghi password=hunter2");
    logger.error({
      error: new Error("upstream failed token=token-value apiKey=secret-key"),
    });

    const output = spy.mock.calls.flat().join(" ");
    expect(output).not.toContain("abc.def.ghi");
    expect(output).not.toContain("hunter2");
    expect(output).not.toContain("token-value");
    expect(output).not.toContain("secret-key");
    expect(output).toContain("[REDACTED]");

    spy.mockRestore();
  });

  it("keeps shared error reporting behind the sanitized telemetry boundary", () => {
    expect(errorReportingSource).toContain(
      'logger.error({ error, context: context ?? "AppError" }, "application_error")',
    );
    expect(errorReportingSource).toContain("sanitizeContext(context.metadata)");
    expect(errorReportingSource).toContain("Sentry.setUser({ id: String(context.userId) })");
    expect(errorReportingSource).not.toContain("email: context.userEmail");
    expect(errorReportingSource).not.toContain("console.error(error.stack)");
  });
});

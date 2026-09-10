import { describe, expect, it, vi } from "vitest";
import { logger } from "../_core/logger.js";

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
});

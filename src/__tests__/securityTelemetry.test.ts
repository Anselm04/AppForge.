import { afterEach, describe, expect, it, vi } from "vitest";
import { sanitizeSentryEvent } from "../middleware/sentryHandler.js";
import { logger } from "../_core/logger.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("#16 telemetry secret redaction", () => {
  it("redacts credentials from arbitrary Sentry strings, nested request data, and exception values", () => {
    const stripeKey = "sk_test_1234567890ABCDEFGHIJ1234567890";
    const modelKey = "sk-ant-1234567890abcdefghijklmnopqrstuv";
    const event = {
      message: "provider failed with " + modelKey,
      exception: {
        values: [{ value: "stripe rejected " + stripeKey }],
      },
      extra: {
        request: {
          body: {
            harmlessName: "payload contains " + modelKey,
            apiKey: modelKey,
          },
          query: {
            next: "token=" + stripeKey,
          },
        },
      },
    };

    const sanitized = sanitizeSentryEvent(event);
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.toContain(stripeKey);
    expect(serialized).not.toContain(modelKey);
    expect(serialized).toContain("redacted");
  });

  it("redacts raw provider credentials embedded in application log messages", () => {
    const modelKey = "sk-ant-1234567890abcdefghijklmnopqrstuv";
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.error("provider request failed: " + modelKey);

    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0].join(" ")).not.toContain(modelKey);
    expect(spy.mock.calls[0].join(" ")).toContain("REDACTED_MODEL_KEY");
  });
});

import { describe, expect, it } from "vitest";
import {
  buildPollingInterval,
  rejectRateLimitedResponse,
  shouldRetryQuery,
} from "../buildPolling.js";

describe("build monitoring request budget", () => {
  it("reserves most of the 200-request / 15-minute budget for customer actions", () => {
    const interval = buildPollingInterval("generating", false, false);
    expect(typeof interval).toBe("number");
    expect((15 * 60 * 1000) / Number(interval)).toBeLessThanOrEqual(100);
  });
  it.each([
    "paused",
    "failed",
    "cancelled",
    "validated",
    "production-certified",
  ])("does not poll a %s build", (status) => {
    expect(buildPollingInterval(status, false, false)).toBe(false);
  });
  it("stops immediately on an event-stream pause or failed project access", () => {
    expect(buildPollingInterval("generating", false, true)).toBe(false);
    expect(buildPollingInterval(undefined, true, false)).toBe(false);
    expect(buildPollingInterval("generating", true, false)).toBe(false);
  });
  it.each([401, 403, 404, 429])(
    "does not retry an HTTP %s middleware rejection",
    (status) => {
      expect(
        shouldRetryQuery(0, {
          message: "Unable to transform response from server",
          meta: { response: { status } },
        }),
      ).toBe(false);
    },
  );
  it("keeps limited retry for temporary failures", () => {
    expect(
      shouldRetryQuery(0, {
        message: "Network failure",
        data: { httpStatus: 503 },
      }),
    ).toBe(true);
    expect(shouldRetryQuery(2, { message: "Network failure" })).toBe(false);
  });
  it("preserves rate-limit meaning instead of returning a malformed tRPC response", () => {
    expect(() => rejectRateLimitedResponse({ status: 429 })).toThrow(
      /Too many requests/,
    );
    expect(() => rejectRateLimitedResponse({ status: 200 })).not.toThrow();
    expect(
      shouldRetryQuery(
        0,
        new Error("Too many requests. Please wait before trying again."),
      ),
    ).toBe(false);
  });
});

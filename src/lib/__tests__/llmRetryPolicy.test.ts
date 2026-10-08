import { describe, it, expect } from "vitest";
import { llmRetryWait } from "../llmRetryPolicy";

describe("provider retry budget", () => {
  it("does not retry permanent request or credential failures", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(llmRetryWait(status, null, undefined)).toBeNull();
    }
  });
  it("honours short cooldowns without truncating long ones", () => {
    expect(llmRetryWait(429, "12", undefined)).toBe(12000);
    expect(llmRetryWait(429, "60", undefined)).toBeNull();
    const now = Date.parse("2026-10-09T00:00:00Z");
    expect(
      llmRetryWait(503, "Fri, 09 Oct 2026 00:00:15 GMT", undefined, now),
    ).toBe(15000);
  });
  it("uses Gemini's structured retry delay", () => {
    expect(
      llmRetryWait(429, null, {
        error: { details: [{ retryDelay: "14.5s" }] },
      }),
    ).toBe(14500);
    expect(
      llmRetryWait(429, null, { error: { details: [{ retryDelay: "44s" }] } }),
    ).toBeNull();
  });
  it("does not hammer exhausted daily or unavailable quotas", () => {
    expect(
      llmRetryWait(429, null, {
        error: {
          details: [
            {
              violations: [
                {
                  quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
                },
              ],
            },
            { retryDelay: "8s" },
          ],
        },
      }),
    ).toBeNull();
    expect(
      llmRetryWait(429, null, {
        error: { details: [{ violations: [{ quotaValue: "0" }] }] },
      }),
    ).toBeNull();
  });
  it("recognizes array-wrapped production quota errors", () => {
    expect(
      llmRetryWait(429, null, [
        {
          error: { details: [{ violations: [{ quotaId: "RequestsPerDay" }] }] },
        },
      ]),
    ).toBeNull();
    expect(
      llmRetryWait(429, null, [
        { error: { details: [{ retryDelay: "12s" }] } },
      ]),
    ).toBe(12000);
  });
  it("ignores malformed optional details without throwing", () => {
    for (const payload of [
      null,
      { error: { details: {} } },
      { error: { details: [{ violations: {}, retryDelay: 3 }] } },
      { error: { details: [{ violations: [null, "wrong"] }] } },
    ]) {
      expect(llmRetryWait(429, null, payload)).toBe(0);
    }
    expect(
      llmRetryWait(429, null, {
        error: { details: [{ violations: [{ quotaValue: 0 }] }] },
      }),
    ).toBeNull();
  });
  it("allows bounded backoff for temporary service failures", () => {
    expect(llmRetryWait(503, null, undefined)).toBe(0);
    expect(llmRetryWait(408, null, undefined)).toBe(0);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../_core/env.js", () => ({
  ENV: {
    twilioAccountSid: "unit-account",
    twilioAuthToken: "unit-secret",
    twilioVerifyServiceSid: "unit-service",
  },
}));
import {
  requestTwilioVerification,
  TwilioVerificationDeliveryError,
} from "../twilioSms.js";
afterEach(() => vi.unstubAllGlobals());

describe("SMS delivery diagnostics (unit tests; no live SMS)", () => {
  it("uses the provided server destination and provider-generated SMS codes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await requestTwilioVerification("configured-destination");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://verify.twilio.com/v2/Services/unit-service/Verifications",
    );
    expect(options.body.get("To")).toBe("configured-destination");
    expect(options.body.get("Channel")).toBe("sms");
    expect(options.body.has("CustomCode")).toBe(false);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("keeps SMS locked on a trial-recipient failure without initiating a voice call", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ code: 21608, message: "private-unit-secret" }),
          { status: 403 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    const error = await requestTwilioVerification(
      "configured-destination",
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TwilioVerificationDeliveryError);
    expect(error).toMatchObject({ httpStatus: 403, providerCode: 21608 });
    expect((error as Error).message).toContain("approved recipient");
    expect((error as Error).message).toContain("Verification remains locked");
    expect((error as Error).message).not.toContain("private-unit-secret");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("handles non-JSON failures without exposing text as a provider code", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("private-unit-secret", { status: 503 }),
        ),
    );
    await expect(
      requestTwilioVerification("configured-destination"),
    ).rejects.toMatchObject({ httpStatus: 503, providerCode: undefined });
  });
});

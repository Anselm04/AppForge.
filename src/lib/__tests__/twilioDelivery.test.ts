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

  it("starts phone-recipient verification recovery when Twilio returns 21608", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ code: 21608, message: "private-unit-secret" }),
          { status: 403 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            validation_code: "unit-validation-code",
            call_sid: "unit-call",
          }),
          { status: 201 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const error = await requestTwilioVerification("configured-destination").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(TwilioVerificationDeliveryError);
    expect(error).toMatchObject({ httpStatus: 403, providerCode: 21608 });
    expect((error as Error).message).toContain("unit-validation-code");
    expect((error as Error).message).toContain("verification call");
    expect((error as Error).message).toContain("Verification remains locked");
    expect((error as Error).message).not.toContain("private-unit-secret");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [recoveryUrl, recoveryOptions] = fetchMock.mock.calls[1];
    expect(recoveryUrl).toBe(
      "https://api.twilio.com/2010-04-01/Accounts/unit-account/OutgoingCallerIds.json",
    );
    expect(recoveryOptions.body.get("PhoneNumber")).toBe(
      "configured-destination",
    );
    expect(recoveryOptions.body.get("FriendlyName")).toBe(
      "AppForge phone verification",
    );
  });

  it("keeps the original 21608 failure when recovery cannot be started", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 21608 }), { status: 403 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 20003 }), { status: 401 }),
        ),
    );

    const error = await requestTwilioVerification("configured-destination").catch(
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(TwilioVerificationDeliveryError);
    expect(error).toMatchObject({ httpStatus: 403, providerCode: 21608 });
    expect((error as Error).message).toContain("approved recipient");
    expect((error as Error).message).toContain("Verification remains locked");
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

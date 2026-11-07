import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../_core/env.js", () => ({
  ENV: {
    twilioAccountSid: "test-account",
    twilioAuthToken: "test-secret",
    twilioVerifyServiceSid: "test-service",
    twilioPhoneNumber: "sender",
  },
}));

import { sendSms } from "../lib/twilioSms.js";
afterEach(() => vi.unstubAllGlobals());

describe("configured SMS Messaging integration", () => {
  it("uses the configured Messaging sender without changing Verify settings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    await sendSms("recipient", "message");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("Messages.json");
    expect(options.body.get("To")).toBe("recipient");
    expect(options.body.get("From")).toBe("sender");
    expect(options.body.get("Body")).toBe("message");
  });

  it("propagates provider failures without claiming delivery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Rejected", { status: 403 })),
    );
    await expect(sendSms("recipient", "message")).rejects.toThrow(
      /SMS delivery failed/,
    );
  });
});

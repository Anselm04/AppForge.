import { createHash, randomInt } from "crypto";
import { ENV } from "../_core/env.js";

let verifyCustomCodesEnabled = false;

function twilioAuthorization(): string {
  return `Basic ${Buffer.from(`${ENV.twilioAccountSid}:${ENV.twilioAuthToken}`).toString("base64")}`;
}

function extractOtp(body: string): string {
  const match = body.match(/\b(\d{4,10})\b/);
  if (!match?.[1]) {
    throw new Error("SMS verification message is missing a 4-10 digit code.");
  }
  return match[1];
}

async function ensureVerifyCustomCodesEnabled(): Promise<void> {
  if (verifyCustomCodesEnabled) return;

  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(ENV.twilioVerifyServiceSid)}`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuthorization(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ CustomCodeEnabled: "true" }),
    },
  );

  if (!res.ok) {
    throw new Error(
      `Twilio Verify service configuration failed (${res.status})`,
    );
  }

  verifyCustomCodesEnabled = true;
}

async function sendVerifySms(to: string, body: string): Promise<void> {
  await ensureVerifyCustomCodesEnabled();

  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${encodeURIComponent(ENV.twilioVerifyServiceSid)}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuthorization(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: to,
        Channel: "sms",
        CustomCode: extractOtp(body),
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Twilio Verify delivery failed (${res.status})`);
  }
}

export function isTwilioConfigured(): boolean {
  return !!(
    ENV.twilioAccountSid &&
    ENV.twilioAuthToken &&
    (ENV.twilioVerifyServiceSid || ENV.twilioPhoneNumber)
  );
}

export function hashOtp(otp: string): string {
  return createHash("sha256")
    .update(otp + ENV.cookieSecret)
    .digest("hex");
}

export function generateOtp(): string {
  return String(randomInt(100000, 999999));
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (!isTwilioConfigured()) {
    throw new Error("SMS is not configured on this server.");
  }

  if (ENV.twilioVerifyServiceSid) {
    await sendVerifySms(to, body);
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${ENV.twilioAccountSid}/Messages.json`;
  const params = new URLSearchParams({
    To: to,
    From: ENV.twilioPhoneNumber,
    Body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: twilioAuthorization(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    throw new Error(`SMS delivery failed (${res.status})`);
  }
}

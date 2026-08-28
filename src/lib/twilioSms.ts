import { createHash, randomInt } from "crypto";
import { ENV } from "../_core/env.js";

export function isTwilioConfigured(): boolean {
  return !!(
    ENV.twilioAccountSid &&
    ENV.twilioAuthToken &&
    ENV.twilioPhoneNumber
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

  const url = `https://api.twilio.com/2010-04-01/Accounts/${ENV.twilioAccountSid}/Messages.json`;
  const params = new URLSearchParams({
    To: to,
    From: ENV.twilioPhoneNumber,
    Body: body,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${ENV.twilioAccountSid}:${ENV.twilioAuthToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    throw new Error(`SMS delivery failed (${res.status})`);
  }
}

/** Twilio Email is the outbound provider; Cloudflare only forwards support mail. */
export function requireTwilioEmailConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = (
    process.env.TWILIO_EMAIL_FROM || process.env.APPFORGE_EMAIL_FROM
  )?.trim();
  // The owner's private inbox is an incoming routing destination, never a default sender.
  if (
    !accountSid ||
    !/^AC[a-f0-9]{32}$/i.test(accountSid) ||
    !authToken ||
    !from ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from)
  ) {
    throw new Error("Twilio email sending is not configured.");
  }
  return { accountSid, authToken, from };
}

/** Supabase-triggered emails retain their signed, server-verified delivery hook. */
export function requireTwilioAuthEmailHookConfig(): void {
  requireTwilioEmailConfig();
  if (!process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET?.trim()) {
    throw new Error("Twilio authentication email hook is not configured.");
  }
}

/** Resolves only when Twilio acknowledges queueing an operation; not delivery proof. */
export async function sendTwilioEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const { accountSid, authToken, from } = requireTwilioEmailConfig();
  const response = await fetch("https://comms.twilio.com/v1/Emails", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { address: from, name: "AppForge" },
      to: [{ address: input.to }],
      content: { subject: input.subject, text: input.text, html: input.html },
    }),
  });
  if (response.status !== 202) {
    throw new Error("Twilio email delivery failed.");
  }
  const body = (await response.json().catch(() => null)) as {
    operationId?: unknown;
  } | null;
  if (typeof body?.operationId !== "string" || !body.operationId.trim()) {
    throw new Error("Twilio did not acknowledge the email operation.");
  }
}

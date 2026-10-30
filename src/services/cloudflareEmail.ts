export function requireCloudflareEmailConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = (
    process.env.CLOUDFLARE_EMAIL_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN
  )?.trim();
  const from = process.env.APPFORGE_EMAIL_FROM?.trim();
  if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId) || !apiToken || !from) {
    throw new Error("Cloudflare email sending is not configured.");
  }
  return { accountId, apiToken, from };
}

/** Supabase-triggered messages must be routed through the configured signed hook. */
export function requireCloudflareAuthEmailHookConfig(): void {
  requireCloudflareEmailConfig();
  if (!process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET?.trim()) {
    throw new Error("Cloudflare authentication email hook is not configured.");
  }
}

/** Transactional outbound email. SMS credentials are never used here. */
export async function sendCloudflareEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const { accountId, apiToken, from } = requireCloudflareEmailConfig();
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`,
    {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: { address: from, name: "AppForge" },
        ...input,
      }),
    },
  );
  const body = (await response.json().catch(() => null)) as {
    success?: boolean;
    result?: unknown;
    delivered?: string[];
    queued?: string[];
  } | null;
  if (!response.ok || !body || body.success === false)
    throw new Error("Cloudflare email delivery failed.");
  // Cloudflare returns delivery results directly; accept an API envelope too.
  const result = (body.result ?? body) as {
    delivered?: string[];
    queued?: string[];
  };
  const accepted = [
    ...(Array.isArray(result.delivered) ? result.delivered : []),
    ...(Array.isArray(result.queued) ? result.queued : []),
  ];
  if (
    !accepted.some(
      (recipient) =>
        typeof recipient === "string" &&
        recipient.toLowerCase() === input.to.toLowerCase(),
    )
  ) {
    throw new Error("Cloudflare did not accept the email recipient.");
  }
}

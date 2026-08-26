import { ENV } from "../_core/env.js";
import { logger } from "../_core/logger.js";

// ── Email Sender Addresses ──
// All addresses are routed to anselm@trillionaitech.com
const SENDER = {
  founder: "Anselm Perkins <anselm@trillionaitech.com>",
  hello: "Trillion AI Tech <hello@trillionaitech.com>",
  support: "AppForge Support <support@trillionaitech.com>",
} as const;

/** Send a single email via Resend REST API */
async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  from: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = ENV.resendApiKey;
  if (!apiKey) {
    logger.warn({ to, subject }, "email_not_sent_no_resend_key");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "unknown");
      logger.error({ status: res.status, body, to }, "resend_email_failed");
      return { success: false, error: `Resend HTTP ${res.status}: ${body}` };
    }

    const data = await res.json().catch(() => ({ id: "unknown" })) as { id?: string };
    logger.info({ to, subject, resendId: data.id }, "email_sent_resend");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ to, subject, error: msg }, "resend_email_exception");
    return { success: false, error: msg };
  }
}

// ── Public API ──

export async function sendEmail(to: string, subject: string, html: string, sender: "hello" | "support" = "hello"): Promise<{ success: boolean }> {
  const result = await sendViaResend(to, subject, html, SENDER[sender]);
  return { success: result.success };
}

export async function notifyTrialEnding(userEmail: string, daysLeft: number): Promise<void> {
  await sendViaResend(
    userEmail,
    `Your AppForge trial ends in ${daysLeft} days`,
    `<p>Hi there,</p>
<p>Your AppForge ${daysLeft}-day free trial ends in <strong>${daysLeft} days</strong>.</p>
<p>Upgrade to a paid plan to keep building apps with the Senior Dev Agent, rollback snapshots, and production self-healing.</p>
<p>Questions? Reply to this email or contact <a href="mailto:support@trillionaitech.com">support@trillionaitech.com</a>.</p>
<p>— Anselm Perkins & the Trillion AI Tech Team</p>`,
    SENDER.hello
  );
}

export async function notifyPaymentFailed(userEmail: string): Promise<void> {
  await sendViaResend(
    userEmail,
    "Action required: Update your payment method",
    `<p>Hi there,</p>
<p>Your AppForge subscription payment failed. Please update your card to avoid service interruption.</p>
<p><a href="https://appforge.dev/pricing">Update payment method →</a></p>
<p>If you need help, contact <a href="mailto:support@trillionaitech.com">support@trillionaitech.com</a>.</p>
<p>— AppForge Support (Trillion AI Tech)</p>`,
    SENDER.support
  );
}

export async function notifyBuildComplete(userEmail: string, projectTitle: string, deployUrl?: string): Promise<void> {
  const cta = deployUrl
    ? `<p><a href="${deployUrl}">View live deployment →</a></p>`
    : `<p><a href="https://appforge.dev/dashboard">Go to your dashboard →</a></p>`;

  await sendViaResend(
    userEmail,
    `"${projectTitle}" is ready on AppForge`,
    `<p>Hi there,</p>
<p>Your app <strong>${projectTitle}</strong> has been successfully built and validated by AppForge.</p>
${cta}
<p>— Anselm Perkins & the Trillion AI Tech Team</p>`,
    SENDER.hello
  );
}

export async function notifyAccountBanned(userEmail: string, reason: string): Promise<void> {
  await sendViaResend(
    userEmail,
    "Account suspended",
    `<p>Hi there,</p>
<p>Your AppForge account has been permanently suspended.</p>
<p><strong>Reason:</strong> ${reason}</p>
<p>If you believe this is an error, contact <a href="mailto:support@trillionaitech.com">support@trillionaitech.com</a> with your account details.</p>
<p>— AppForge Trust & Safety (Trillion AI Tech)</p>`,
    SENDER.support
  );
}
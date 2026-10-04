import { ENV } from "../_core/env.js";
import { logger } from "../_core/logger.js";

function appForgeSender(): string {
  return process.env.APPFORGE_EMAIL_FROM?.trim() || "";
}

function supportContact(): string {
  const email = process.env.APPFORGE_SUPPORT_EMAIL?.trim();
  return email
    ? `<a href="mailto:${email}">${email}</a>`
    : "AppForge Support";
}

function appUrl(path: string): string {
  const base = (process.env.PUBLIC_APP_URL || process.env.APP_URL || "").trim();
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

/** Send a single email via Resend REST API */
async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  from: string,
): Promise<{ success: boolean; error?: string }> {
  const apiKey = ENV.resendApiKey;
  if (!apiKey) {
    logger.warn({ to, subject }, "email_not_sent_no_resend_key");
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  if (!from) {
    logger.error({ to, subject }, "email_not_sent_no_appforge_sender");
    return { success: false, error: "APPFORGE_EMAIL_FROM not configured" };
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

    const data = (await res.json().catch(() => ({ id: "unknown" }))) as {
      id?: string;
    };
    logger.info({ to, subject, resendId: data.id }, "email_sent_resend");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ to, subject, error: msg }, "resend_email_exception");
    return { success: false, error: msg };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  _sender: "hello" | "support" = "hello",
): Promise<{ success: boolean }> {
  const result = await sendViaResend(to, subject, html, appForgeSender());
  return { success: result.success };
}

export async function notifyTrialEnding(
  userEmail: string,
  daysLeft: number,
): Promise<void> {
  await sendViaResend(
    userEmail,
    `Your AppForge trial ends in ${daysLeft} days`,
    `<p>Hi there,</p>
<p>Your AppForge ${daysLeft}-day free trial ends in <strong>${daysLeft} days</strong>.</p>
<p>Upgrade to a paid plan to keep building apps with the Senior Dev Agent, rollback snapshots, and production self-healing.</p>
<p>Questions? Contact ${supportContact()}.</p>
<p>— AppForge</p>`,
    appForgeSender(),
  );
}

export async function notifyPaymentFailed(userEmail: string): Promise<void> {
  await sendViaResend(
    userEmail,
    "Action required: Update your payment method",
    `<p>Hi there,</p>
<p>Your AppForge subscription payment failed. Please update your card to avoid service interruption.</p>
<p><a href="${appUrl("/pricing")}">Update payment method →</a></p>
<p>If you need help, contact ${supportContact()}.</p>
<p>— AppForge Support</p>`,
    appForgeSender(),
  );
}

export async function notifyBuildComplete(
  userEmail: string,
  projectTitle: string,
  deployUrl?: string,
): Promise<void> {
  const cta = deployUrl
    ? `<p><a href="${deployUrl}">View live deployment →</a></p>`
    : `<p><a href="${appUrl("/dashboard")}">Go to your dashboard →</a></p>`;

  await sendViaResend(
    userEmail,
    `"${projectTitle}" is ready on AppForge`,
    `<p>Hi there,</p>
<p>Your app <strong>${projectTitle}</strong> has been successfully built and validated by AppForge.</p>
${cta}
<p>— AppForge</p>`,
    appForgeSender(),
  );
}

export async function notifyAccountBanned(
  userEmail: string,
  reason: string,
): Promise<void> {
  await sendViaResend(
    userEmail,
    "Account suspended",
    `<p>Hi there,</p>
<p>Your AppForge account has been permanently suspended.</p>
<p><strong>Reason:</strong> ${reason}</p>
<p>If you believe this is an error, contact ${supportContact()} with your account details.</p>
<p>— AppForge Trust & Safety</p>`,
    appForgeSender(),
  );
}

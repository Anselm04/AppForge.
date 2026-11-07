import { sendTwilioEmail } from "./twilioEmail.js";
import { logger } from "../_core/logger.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] ?? char;
  });
}

function safeHttpsUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function appForgeSender(): string {
  return process.env.APPFORGE_EMAIL_FROM?.trim() || "";
}

function supportContact(): string {
  const email = process.env.APPFORGE_SUPPORT_EMAIL?.trim();
  const valid = email && /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email);
  return valid
    ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`
    : "AppForge Support";
}

function appUrl(path: string): string {
  const base = (process.env.PUBLIC_APP_URL || process.env.APP_URL || "").trim();
  return base ? `${base.replace(/\/$/, "")}${path}` : path;
}

/** Customer notifications use the same Twilio Email provider as auth. */
async function sendViaTwilio(
  to: string,
  subject: string,
  html: string,
  _from: string,
): Promise<{ success: boolean }> {
  try {
    await sendTwilioEmail({
      to,
      subject,
      html,
      text: html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    });
    return { success: true };
  } catch {
    logger.error({ provider: "twilio" }, "customer_email_delivery_failed");
    return { success: false };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  _sender: "hello" | "support" = "hello",
): Promise<{ success: boolean }> {
  const result = await sendViaTwilio(to, subject, html, appForgeSender());
  return { success: result.success };
}

export async function notifyTrialEnding(
  userEmail: string,
  daysLeft: number,
): Promise<void> {
  await sendViaTwilio(
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
  await sendViaTwilio(
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
  const safeDeployment = safeHttpsUrl(deployUrl);
  const dashboard = safeHttpsUrl(appUrl("/dashboard"));
  const cta = safeDeployment
    ? `<p><a href="${escapeHtml(safeDeployment)}">View live deployment →</a></p>`
    : dashboard
      ? `<p><a href="${escapeHtml(dashboard)}">Go to your dashboard →</a></p>`
      : "";
  const title = projectTitle.replace(/[\r\n]+/g, " ").trim().slice(0, 120);

  await sendViaTwilio(
    userEmail,
    `"${title}" is ready on AppForge`,
    `<p>Hi there,</p>
<p>Your app <strong>${escapeHtml(projectTitle)}</strong> has been successfully built and validated by AppForge.</p>
${cta}
<p>— AppForge</p>`,
    appForgeSender(),
  );
}

export async function notifyAccountBanned(
  userEmail: string,
  reason: string,
): Promise<void> {
  await sendViaTwilio(
    userEmail,
    "Account suspended",
    `<p>Hi there,</p>
<p>Your AppForge account has been permanently suspended.</p>
<p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
<p>If you believe this is an error, contact ${supportContact()} with your account details.</p>
<p>— AppForge Trust & Safety</p>`,
    appForgeSender(),
  );
}

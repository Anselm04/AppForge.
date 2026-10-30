import { createHmac, timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { z } from "zod";
import { sendCloudflareEmail } from "../services/cloudflareEmail.js";
import { appActionLink } from "../services/authEmailDelivery.js";
import {
  passwordRecoveryRedirect,
  signupRedirect,
} from "../services/authRedirect.js";

const payloadSchema = z.object({
  user: z.object({
    email: z.string().email(),
    new_email: z.string().optional(),
  }),
  email_data: z.object({
    email_action_type: z.string(),
    token: z.string().optional(),
    token_hash: z.string().optional(),
    token_hash_new: z.string().optional(),
    redirect_to: z.string().optional(),
  }),
});

/** Standard Webhooks signature, verified over the original bytes before JSON parsing. */
function authenticHook(
  body: string,
  id: string | undefined,
  timestamp: string | undefined,
  signatures: string | undefined,
): boolean {
  const secret = process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET?.replace(
    /^v1,whsec_/,
    "",
  ).replace(/^whsec_/, "");
  if (!secret || !id || !timestamp || !signatures || !/^\d+$/.test(timestamp))
    return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;
  const key = Buffer.from(secret, "base64");
  if (key.length < 32) return false;
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest();
  return signatures.split(/\s+/).some((entry) => {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) return false;
    const actual = Buffer.from(signature, "base64");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}

async function deliverLink(
  to: string,
  hash: string | undefined,
  type: Parameters<typeof appActionLink>[2],
  destination: string,
  subject: string,
) {
  if (!hash) throw new Error("Missing email verification hash");
  const link = appActionLink({ hashed_token: hash }, destination, type);
  await sendCloudflareEmail({
    to,
    subject,
    text: `${subject}: ${link}`,
    html: `<p>${escapeHtml(subject)}</p><p><a href="${escapeHtml(link)}">Continue in AppForge</a></p>`,
  });
}

export const authEmailHookHandler: RequestHandler = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!Buffer.isBuffer(req.body))
    return res.status(400).json({ error: "Raw webhook body required" });
  const body = req.body.toString("utf8");
  if (
    !authenticHook(
      body,
      req.get("webhook-id"),
      req.get("webhook-timestamp"),
      req.get("webhook-signature"),
    )
  ) {
    return res.status(401).json({ error: "Invalid email hook signature" });
  }
  try {
    const { user, email_data: email } = payloadSchema.parse(JSON.parse(body));
    const action = email.email_action_type;
    const defaultDestination = signupRedirect("/");
    let destination = defaultDestination;
    if (email.redirect_to) {
      const requested = new URL(email.redirect_to, defaultDestination);
      if (
        requested.origin === new URL(defaultDestination).origin &&
        requested.pathname === "/login"
      )
        destination = requested.toString();
    }
    if (action === "reauthentication") {
      if (!/^\d{6,10}$/.test(email.token ?? ""))
        throw new Error("Missing verification code");
      await sendCloudflareEmail({
        to: user.email,
        subject: "Verify your AppForge password change",
        text: `Your verification code is ${email.token}. If you did not request it, ignore this email.`,
        html: `<p>Your password-change verification code is <strong>${email.token}</strong>.</p><p>If you did not request it, ignore this email.</p>`,
      });
    } else if (action === "email_change") {
      const newEmail = z.string().email().parse(user.new_email);
      // Supabase's naming is reversed: token_hash_new belongs to the current
      // email; token_hash belongs to the new email. Never skip either approval.
      if (email.token_hash_new)
        await deliverLink(
          user.email,
          email.token_hash_new,
          "email_change",
          signupRedirect("/account"),
          "Approve your AppForge email change",
        );
      await deliverLink(
        newEmail,
        email.token_hash,
        "email_change",
        signupRedirect("/account"),
        "Confirm your new AppForge email",
      );
    } else if (
      ["signup", "email", "recovery", "invite", "magiclink"].includes(action)
    ) {
      const subject =
        action === "recovery"
          ? "Reset your AppForge password"
          : "Confirm your AppForge email";
      await deliverLink(
        user.email,
        email.token_hash,
        action as Parameters<typeof appActionLink>[2],
        action === "recovery" ? passwordRecoveryRedirect() : destination,
        subject,
      );
    } else if (action.endsWith("_notification")) {
      await sendCloudflareEmail({
        to: user.email,
        subject: "AppForge account security notification",
        text: "A security setting on your AppForge account has changed. If you did not make this change, recover your account and contact support.",
        html: "<p>A security setting on your AppForge account has changed.</p><p>If you did not make this change, recover your account and contact support.</p>",
      });
    } else {
      throw new Error("Unsupported authentication email");
    }
    return res.status(200).json({});
  } catch {
    // Never return or log the event body, OTP, token hash or provider response.
    return res
      .status(503)
      .json({ error: "Unable to deliver authentication email" });
  }
};

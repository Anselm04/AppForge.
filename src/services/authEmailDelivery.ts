import { createClient } from "@supabase/supabase-js";
import { ENV } from "../_core/env.js";
import {
  requireTwilioEmailConfig,
  requireTwilioAuthEmailHookConfig,
  sendTwilioEmail,
} from "./twilioEmail.js";

export type SignupConfirmationInput = {
  email: string;
  phone: string;
  password: string;
  redirectTo: string;
};

type ConfirmationLink = {
  actionLink: string;
  userId: string;
};

type ConfirmationEmail = {
  to: string;
  subject: string;
  confirmationUrl: string;
};

type SignupConfirmationDeps = {
  generateLink: (input: SignupConfirmationInput) => Promise<ConfirmationLink>;
  sendEmail: (input: ConfirmationEmail) => Promise<void>;
  rollbackUser?: (userId: string) => Promise<void>;
};

function requireServerAuthConfig() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey) {
    throw new Error("Supabase signup confirmation is not configured");
  }
}

function serverAuthClient() {
  requireServerAuthConfig();
  return createClient(ENV.supabaseUrl, ENV.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function appActionLink(
  properties:
    | { hashed_token?: string; action_link?: string; actionLink?: string }
    | undefined,
  redirectTo: string,
  type:
    "signup" | "recovery" | "email" | "email_change" | "invite" | "magiclink",
): string {
  // Exchange the one-time hash inside AppForge. This keeps confirmation and
  // recovery on the intended app route even if the provider's Site URL differs.
  if (properties?.hashed_token) {
    const url = new URL(redirectTo);
    url.searchParams.set("token_hash", properties.hashed_token);
    url.searchParams.set("type", type);
    return url.toString();
  }
  return properties?.action_link || properties?.actionLink || "";
}

async function generateSupabaseSignupLink(
  input: SignupConfirmationInput,
): Promise<ConfirmationLink> {
  const supabase = serverAuthClient();

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: {
      redirectTo: input.redirectTo,
      data: {
        signup_phone: input.phone,
        signup_phone_verified: false,
      },
    },
  });
  if (error) throw error;

  const properties = data?.properties as
    | { hashed_token?: string; action_link?: string; actionLink?: string }
    | undefined;
  const actionLink = appActionLink(properties, input.redirectTo, "signup");
  const userId = data?.user?.id || "";
  if (!actionLink || !userId) {
    throw new Error("Supabase did not produce a signup confirmation link");
  }

  return { actionLink, userId };
}

async function sendTwilioConfirmationEmail(
  input: ConfirmationEmail,
): Promise<void> {
  await sendTwilioEmail({
    to: input.to,
    subject: input.subject,
    text: `Confirm your AppForge email address: ${input.confirmationUrl}`,
    html: `<p>Confirm your AppForge email address to continue creating your account.</p><p><a href="${input.confirmationUrl}">Confirm email address</a></p><p>After email confirmation, AppForge will verify the mobile number you entered during signup.</p>`,
  });
}

async function rollbackSupabaseSignup(userId: string): Promise<void> {
  const supabase = serverAuthClient();
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) throw error;
}

const productionDeps: SignupConfirmationDeps = {
  generateLink: generateSupabaseSignupLink,
  sendEmail: sendTwilioConfirmationEmail,
  rollbackUser: rollbackSupabaseSignup,
};

export async function createSignupConfirmation(
  input: SignupConfirmationInput,
  deps: SignupConfirmationDeps = productionDeps,
): Promise<{ userId: string; confirmationSent: true }> {
  if (deps === productionDeps) {
    requireServerAuthConfig();
    requireTwilioEmailConfig();
  }
  const link = await deps.generateLink(input);
  try {
    await deps.sendEmail({
      to: input.email,
      subject: "Confirm your AppForge email",
      confirmationUrl: link.actionLink,
    });
  } catch (deliveryError) {
    if (deps.rollbackUser) {
      try {
        await deps.rollbackUser(link.userId);
      } catch {
        // Preserve the original provider error. A failed rollback is still
        // fail-closed and the resend flow can recover the pending identity.
      }
    }
    throw deliveryError;
  }
  return { userId: link.userId, confirmationSent: true };
}

export async function sendPasswordRecovery(input: {
  email: string;
  redirectTo: string;
}): Promise<void> {
  const supabase = serverAuthClient();
  requireTwilioEmailConfig();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: input.email,
    options: { redirectTo: input.redirectTo },
  });

  if (error) {
    const code = error.code || "";
    if (["user_not_found", "email_not_found"].includes(code)) return;
    if (/user.*not found|email.*not found/i.test(error.message || "")) return;
    throw error;
  }

  const properties = data?.properties as
    | { hashed_token?: string; action_link?: string; actionLink?: string }
    | undefined;
  const actionLink = appActionLink(properties, input.redirectTo, "recovery");
  if (!actionLink) {
    throw new Error("Supabase did not produce a password recovery link");
  }

  await sendTwilioEmail({
    to: input.email,
    subject: "Reset your AppForge password",
    text: `Reset your AppForge password: ${actionLink}`,
    html: `<p>A password reset was requested for your AppForge account.</p><p><a href="${actionLink}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

/** Supabase resend uses the existing signup identity; it never changes its password. */
export async function resendSignupConfirmation(input: {
  email: string;
  redirectTo: string;
}): Promise<void> {
  requireTwilioAuthEmailHookConfig();
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!ENV.supabaseUrl || !key) {
    throw new Error("Supabase confirmation resend is not configured");
  }
  const client = createClient(ENV.supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.resend({
    type: "signup",
    email: input.email,
    options: { emailRedirectTo: input.redirectTo },
  });
  if (
    error &&
    !["user_not_found", "email_not_found", "email_already_confirmed"].includes(
      error.code || "",
    )
  ) {
    throw error;
  }
}

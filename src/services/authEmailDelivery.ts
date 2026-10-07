import { createClient } from "@supabase/supabase-js";
import { ENV } from "../_core/env.js";

export type SignupConfirmationInput = {
  email: string;
  password: string;
  redirectTo: string;
  fullName: string;
  phone: string;
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
};

function requireServerAuthConfig() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey) {
    throw new Error("Supabase signup confirmation is not configured");
  }
}

function requireTwilioEmailConfig() {
  const from = (
    process.env.TWILIO_EMAIL_FROM ||
    ENV.ownerEmail ||
    ""
  ).trim();
  if (!ENV.twilioAccountSid || !ENV.twilioAuthToken || !from) {
    throw new Error("Twilio signup email delivery is not configured");
  }
  return { from };
}

async function generateSupabaseSignupLink(
  input: SignupConfirmationInput,
): Promise<ConfirmationLink> {
  requireServerAuthConfig();
  const supabase = createClient(ENV.supabaseUrl, ENV.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: {
      redirectTo: input.redirectTo,
      data: {
        full_name: input.fullName,
        name: input.fullName,
        phone: input.phone,
      },
    },
  });
  if (error) throw error;

  const properties = data?.properties as
    | { action_link?: string; actionLink?: string }
    | undefined;
  const actionLink = properties?.action_link || properties?.actionLink || "";
  const userId = data?.user?.id || "";
  if (!actionLink || !userId) {
    throw new Error("Supabase did not produce a signup confirmation link");
  }

  return { actionLink, userId };
}

async function sendTwilioConfirmationEmail(
  input: ConfirmationEmail,
): Promise<void> {
  const { from } = requireTwilioEmailConfig();
  const authorization = Buffer.from(
    `${ENV.twilioAccountSid}:${ENV.twilioAuthToken}`,
  ).toString("base64");

  const response = await fetch("https://comms.twilio.com/v1/Emails", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { address: from, name: "AppForge" },
      to: [{ address: input.to }],
      content: {
        subject: input.subject,
        text: `Confirm your AppForge email address: ${input.confirmationUrl}`,
        html: `<p>Confirm your AppForge email address to finish creating your account.</p><p><a href="${input.confirmationUrl}">Confirm email address</a></p>`,
      },
    }),
  });

  if (response.status !== 202) {
    throw new Error(`Twilio email delivery failed (${response.status})`);
  }
}

const productionDeps: SignupConfirmationDeps = {
  generateLink: generateSupabaseSignupLink,
  sendEmail: sendTwilioConfirmationEmail,
};

export async function createSignupConfirmation(
  input: SignupConfirmationInput,
  deps: SignupConfirmationDeps = productionDeps,
): Promise<{ userId: string; confirmationSent: true }> {
  const link = await deps.generateLink(input);
  await deps.sendEmail({
    to: input.email,
    subject: "Confirm your AppForge email",
    confirmationUrl: link.actionLink,
  });
  return { userId: link.userId, confirmationSent: true };
}

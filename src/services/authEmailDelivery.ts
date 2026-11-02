import { createClient } from "@supabase/supabase-js";
import { ENV } from "../_core/env.js";

export type SignupConfirmationInput = {
  email: string;
  phone: string;
  password: string;
  redirectTo: string;
};

type AuthErrorLike = {
  code?: string;
  message?: string;
};

function publicAuthKey(): string {
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!ENV.supabaseUrl || !key) {
    throw new Error("Supabase authentication is not configured");
  }

  return key;
}

function publicAuthClient() {
  return createClient(ENV.supabaseUrl, publicAuthKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function isNonEnumeratingAuthError(error: AuthErrorLike | null): boolean {
  if (!error) return false;
  const code = error.code || "";
  if (
    [
      "user_not_found",
      "email_not_found",
      "email_already_confirmed",
    ].includes(code)
  ) {
    return true;
  }

  return /user.*not found|email.*not found|already.*confirmed/i.test(
    error.message || "",
  );
}

/**
 * Create a pending Supabase identity and let Supabase Auth deliver the
 * confirmation message through its configured email transport. The signup
 * phone is deliberately untrusted metadata until Twilio Verify confirms it.
 */
export async function createSignupConfirmation(
  input: SignupConfirmationInput,
): Promise<{ userId: string; confirmationSent: true }> {
  const client = publicAuthClient();
  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: input.redirectTo,
      data: {
        signup_phone: input.phone,
        signup_phone_verified: false,
      },
    },
  });

  if (error) throw error;

  const userId = data.user?.id?.trim();
  if (!userId) {
    throw new Error("Supabase signup did not return a user id");
  }

  return { userId, confirmationSent: true };
}

/**
 * Supabase resend targets the existing pending identity. It never creates a
 * replacement user and never changes the user's password.
 */
export async function resendSignupConfirmation(input: {
  email: string;
  redirectTo: string;
}): Promise<void> {
  const client = publicAuthClient();
  const { error } = await client.auth.resend({
    type: "signup",
    email: input.email,
    options: { emailRedirectTo: input.redirectTo },
  });

  if (error && !isNonEnumeratingAuthError(error)) {
    throw error;
  }
}

/**
 * Password recovery is owned by Supabase Auth so the reset token lifecycle
 * and configured email transport remain in one identity system.
 */
export async function sendPasswordRecovery(input: {
  email: string;
  redirectTo: string;
}): Promise<void> {
  const client = publicAuthClient();
  const { error } = await client.auth.resetPasswordForEmail(input.email, {
    redirectTo: input.redirectTo,
  });

  if (error && !isNonEnumeratingAuthError(error)) {
    throw error;
  }
}

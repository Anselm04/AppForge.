import { ENV } from "../_core/env.js";
import { requireTwilioAuthEmailHookConfig } from "./twilioEmail.js";

/** Use the customer's JWT so provider email/password protections still apply. */
export async function updateAccountCredentials(
  accessToken: string,
  change: { password: string; nonce?: string } | { email: string },
): Promise<void> {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey) {
    throw new Error("Account management is not configured.");
  }
  if ("email" in change) requireTwilioAuthEmailHookConfig();
  const response = await fetch(`${ENV.supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    signal: AbortSignal.timeout(10_000),
    headers: {
      apikey: ENV.supabaseServiceKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(change),
  });
  if (!response.ok) {
    const details = (await response.json().catch(() => null)) as {
      code?: string;
      error_code?: string;
    } | null;
    const code = details?.code ?? details?.error_code;
    if (
      code === "reauthentication_needed" ||
      code === "reauthentication_not_valid"
    ) {
      throw new Error(
        "Send a password verification code, then enter the new code before changing your password.",
      );
    }
    // Do not surface provider diagnostics or credentials through the API.
    throw new Error(
      response.status === 401 || response.status === 403
        ? "Sign in again before changing your account credentials."
        : "Unable to update account credentials. Check your details and try again.",
    );
  }
}

export async function requestAccountReauthentication(
  accessToken: string,
): Promise<void> {
  requireTwilioAuthEmailHookConfig();
  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey) {
    throw new Error("Account management is not configured.");
  }
  const response = await fetch(`${ENV.supabaseUrl}/auth/v1/reauthenticate`, {
    method: "GET",
    signal: AbortSignal.timeout(10_000),
    headers: {
      apikey: ENV.supabaseServiceKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) {
    throw new Error(
      "Unable to send a password verification code. Sign in again or try later.",
    );
  }
}

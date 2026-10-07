import { supabaseClient } from "./supabase-client.js";
import { clearCsrfToken, withCsrfHeaders } from "./csrf.js";
import { rememberAuthenticatedUser, type AppForgeSession } from "./auth.js";

export type PendingPasswordLogin = {
  user: AppForgeSession["user"];
};

async function establishPrimaryServerSession(
  accessToken: string,
  refreshToken?: string,
): Promise<void> {
  const send = async () => {
    const headers = await withCsrfHeaders({
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(refreshToken ? { "x-supabase-refresh-token": refreshToken } : {}),
    });
    return fetch("/api/auth/session", {
      method: "POST",
      credentials: "same-origin",
      headers,
    });
  };

  let response = await send();
  if (response.status === 403) {
    clearCsrfToken();
    response = await send();
  }
  if (!response.ok) {
    throw new Error("Unable to establish a secure login session.");
  }
}

export async function beginPasswordSignIn(
  email: string,
  password: string,
): Promise<PendingPasswordLogin> {
  const result = await supabaseClient.signIn(email, password);
  if (!result.access_token || !result.user?.id) {
    throw new Error(result.error?.message || "Sign-in failed.");
  }

  await establishPrimaryServerSession(result.access_token, result.refresh_token);
  return {
    user: {
      id: result.user.id,
      email: result.user.email,
    },
  };
}

export function completeVerifiedLogin(user: {
  id: string;
  email?: string;
  phone?: string;
}): AppForgeSession {
  return rememberAuthenticatedUser(user);
}

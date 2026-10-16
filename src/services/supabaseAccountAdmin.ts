import { createClient } from "@supabase/supabase-js";
import { ENV } from "../_core/env.js";

function adminClient() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey) {
    throw new Error("Supabase account administration is not configured");
  }
  return createClient(ENV.supabaseUrl, ENV.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function verifySupabaseAuthUser(
  accessToken: string,
  expectedUserId: string,
): Promise<void> {
  const token = accessToken.trim();
  const expected = expectedUserId.trim();
  if (!token || !expected) throw new Error("Verified sign-in is required");

  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user || data.user.id !== expected) {
    throw new Error(
      "For security, sign in again before permanently deleting your account.",
    );
  }
}

export async function deleteSupabaseAuthUser(userId: string): Promise<void> {
  const normalized = userId.trim();
  if (!normalized) throw new Error("Supabase user id is required");

  const { error } = await adminClient().auth.admin.deleteUser(normalized, false);
  if (error) {
    throw new Error(`Unable to revoke account identity: ${error.message}`);
  }
}

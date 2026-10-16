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

export async function deleteSupabaseAuthUser(userId: string): Promise<void> {
  const normalized = userId.trim();
  if (!normalized) throw new Error("Supabase user id is required");

  const { error } = await adminClient().auth.admin.deleteUser(
    normalized,
    false,
  );
  if (error) {
    throw new Error(`Unable to revoke account identity: ${error.message}`);
  }
}

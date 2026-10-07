import { createClient } from "@supabase/supabase-js";
import { ENV } from "../_core/env.js";
import { isOwnerEmail } from "../lib/owner.js";

function normalizePhone(value: unknown): string {
  const phone = typeof value === "string" ? value.trim().replace(/[\s()-]/g, "") : "";
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : "";
}

export function maskPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  return normalized ? `••••${normalized.slice(-4)}` : "";
}

export async function resolveLoginVerificationPhone(input: {
  supabaseUid: string;
  email: string;
}): Promise<string> {
  if (isOwnerEmail(input.email)) {
    const ownerPhone = normalizePhone(ENV.ownerPhone);
    if (!ownerPhone) throw new Error("Owner phone verification is not configured");
    return ownerPhone;
  }

  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey) {
    throw new Error("Authentication service is not configured");
  }

  const supabase = createClient(ENV.supabaseUrl, ENV.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.admin.getUserById(input.supabaseUid);
  if (error || !data.user) {
    throw new Error("Unable to load account verification details");
  }

  const phone = normalizePhone(
    data.user.user_metadata?.["phone"] ?? data.user.phone ?? "",
  );
  if (!phone) {
    throw new Error("Phone verification setup is required for this account");
  }
  return phone;
}

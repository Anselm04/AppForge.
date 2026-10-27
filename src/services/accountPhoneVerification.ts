import { createClient } from "@supabase/supabase-js";
import { ENV } from "../_core/env.js";
import {
  checkTwilioVerification,
  requestTwilioVerification,
} from "../lib/twilioSms.js";

function normalizePhone(phone: string): string {
  const normalized = phone.trim().replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("A valid mobile number in international format is required.");
  }
  return normalized;
}

function serverAuthClient() {
  if (!ENV.supabaseUrl || !ENV.supabaseServiceKey) {
    throw new Error("Supabase account verification is not configured.");
  }
  return createClient(ENV.supabaseUrl, ENV.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requestAccountPhoneVerification(
  phone: string,
): Promise<void> {
  await requestTwilioVerification(normalizePhone(phone));
}

export async function verifyAccountPhone(input: {
  supabaseUid: string;
  phone: string;
  code: string;
}): Promise<boolean> {
  const phone = normalizePhone(input.phone);
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) return false;

  const approved = await checkTwilioVerification(phone, code);
  if (!approved) return false;

  const supabase = serverAuthClient();
  const { data: current, error: readError } =
    await supabase.auth.admin.getUserById(input.supabaseUid);
  if (readError || !current.user) {
    throw readError || new Error("Unable to load the authenticated account.");
  }

  const existingMetadata = current.user.user_metadata ?? {};
  const { error } = await supabase.auth.admin.updateUserById(input.supabaseUid, {
    phone,
    phone_confirm: true,
    user_metadata: {
      ...existingMetadata,
      signup_phone: phone,
      signup_phone_verified: true,
    },
  });
  if (error) throw error;

  return true;
}

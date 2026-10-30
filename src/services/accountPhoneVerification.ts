import { createClient } from "@supabase/supabase-js";
import { ENV } from "../_core/env.js";
import {
  checkTwilioVerification,
  requestTwilioVerification,
} from "../lib/twilioSms.js";

function normalizePhone(phone: string): string {
  const normalized = phone.trim().replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error(
      "A valid mobile number in international format is required.",
    );
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

function storedPhone(user: {
  phone?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}): string | undefined {
  const pendingPhone = user.app_metadata?.["pending_phone"];
  if (typeof pendingPhone === "string" && pendingPhone) {
    return normalizePhone(pendingPhone);
  }
  const metadataPhone = user.user_metadata?.["signup_phone"];
  const metadataVerified =
    user.user_metadata?.["signup_phone_verified"] === true;

  if (typeof metadataPhone === "string" && metadataPhone && !metadataVerified) {
    return normalizePhone(metadataPhone);
  }
  if (typeof user.phone === "string" && user.phone) {
    return normalizePhone(user.phone);
  }
  return typeof metadataPhone === "string" && metadataPhone
    ? normalizePhone(metadataPhone)
    : undefined;
}

export async function requestAccountPhoneVerification(input: {
  supabaseUid: string;
  phone?: string;
}): Promise<{ phone: string; alreadyVerified: boolean }> {
  const supabase = serverAuthClient();
  const { data: current, error: readError } =
    await supabase.auth.admin.getUserById(input.supabaseUid);
  if (readError || !current.user) {
    throw readError || new Error("Unable to load the authenticated account.");
  }

  const existing = storedPhone(current.user);
  const requested = input.phone ? normalizePhone(input.phone) : existing;
  if (!requested) {
    throw new Error("Enter a mobile number before requesting an SMS code.");
  }

  if (current.user.phone_confirmed_at && current.user.phone === requested) {
    return { phone: requested, alreadyVerified: true };
  }

  // Bind verification to this account using metadata only the server can edit.
  // The signup metadata is an input hint, never an authoritative challenge.
  const { error } = await supabase.auth.admin.updateUserById(
    input.supabaseUid,
    {
      app_metadata: {
        ...current.user.app_metadata,
        pending_phone: requested,
        pending_phone_requested_at: Date.now(),
      },
      user_metadata: {
        ...current.user.user_metadata,
        signup_phone: requested,
        signup_phone_verified: false,
      },
    },
  );
  if (error) throw error;

  await requestTwilioVerification(requested);
  return { phone: requested, alreadyVerified: false };
}

export async function verifyAccountPhone(input: {
  supabaseUid: string;
  code: string;
}): Promise<boolean> {
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) return false;

  const supabase = serverAuthClient();
  const { data: current, error: readError } =
    await supabase.auth.admin.getUserById(input.supabaseUid);
  if (readError || !current.user) {
    throw readError || new Error("Unable to load the authenticated account.");
  }

  const phone = storedPhone(current.user);
  if (!phone) {
    throw new Error("No mobile number is attached to this account.");
  }
  if (current.user.phone_confirmed_at && current.user.phone === phone) {
    return true;
  }

  const requestedAt = current.user.app_metadata?.["pending_phone_requested_at"];
  if (
    current.user.app_metadata?.["pending_phone"] !== phone ||
    typeof requestedAt !== "number" ||
    !Number.isFinite(requestedAt) ||
    requestedAt > Date.now() ||
    Date.now() - requestedAt > 10 * 60_000
  ) {
    throw new Error("Request a new SMS code before verifying your phone.");
  }

  const approved = await checkTwilioVerification(phone, code);
  if (!approved) return false;

  const existingMetadata = current.user.user_metadata ?? {};
  const { error } = await supabase.auth.admin.updateUserById(
    input.supabaseUid,
    {
      phone,
      phone_confirm: true,
      app_metadata: {
        ...current.user.app_metadata,
        pending_phone: null,
        pending_phone_requested_at: null,
      },
      user_metadata: {
        ...existingMetadata,
        signup_phone: phone,
        signup_phone_verified: true,
      },
    },
  );
  if (error) throw error;

  return true;
}

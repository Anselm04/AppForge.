import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type RuntimeAuthConfig = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
};

type PhoneSession = {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
  };
};

type PhoneOtpAuthFacade = {
  signInWithOtp(credentials: { phone: string }): Promise<{
    data: unknown;
    error: Error | null;
  }>;
  verifyOtp(credentials: {
    phone: string;
    token: string;
    type: "sms";
  }): Promise<{
    data: { session: PhoneSession | null };
    error: Error | null;
  }>;
  signOut(): Promise<{ error: Error | null }>;
};

let client: SupabaseClient | null = null;

function readSupabaseConfig() {
  const runtime =
    typeof window !== "undefined"
      ? (window as Window & { __APPFORGE_CONFIG__?: RuntimeAuthConfig })
          .__APPFORGE_CONFIG__
      : undefined;
  const url =
    runtime?.supabaseUrl ||
    (import.meta.env.VITE_SUPABASE_URL as string | undefined);
  const publishableKey =
    runtime?.supabasePublishableKey ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

  if (!url || !publishableKey) {
    throw new Error("Supabase authentication is not configured.");
  }

  return { url, publishableKey };
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const { url, publishableKey } = readSupabaseConfig();
  client = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return client;
}

const auth: PhoneOtpAuthFacade = {
  async signInWithOtp(credentials) {
    return getSupabaseClient().auth.signInWithOtp(credentials);
  },
  async verifyOtp(credentials) {
    return getSupabaseClient().auth.verifyOtp(credentials);
  },
  async signOut() {
    return getSupabaseClient().auth.signOut();
  },
};

export const supabase: { auth: PhoneOtpAuthFacade } = { auth };

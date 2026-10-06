import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type RuntimeAuthConfig = {
  supabaseUrl?: string;
  supabasePublishableKey?: string;
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

export const supabase = {
  get auth() {
    return getSupabaseClient().auth;
  },
};

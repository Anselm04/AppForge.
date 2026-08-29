import { ENV } from "../_core/env.js";

export type RegisterSsoProviderInput = {
  provider: "saml" | "oidc";
  metadataUrl?: string;
  domains: string[];
  clientId?: string;
};

export type RegisterSsoProviderResult = {
  providerId: string;
  acsUrl: string;
  entityId: string;
};

function supabaseAuthBase(): string {
  const url = ENV.supabaseUrl.replace(/\/$/, "");
  if (!url) throw new Error("SUPABASE_URL is not configured");
  return `${url}/auth/v1`;
}

/** Register or update a SAML/OIDC provider in Supabase Auth (service role). */
export async function registerSupabaseSsoProvider(
  input: RegisterSsoProviderInput,
): Promise<RegisterSsoProviderResult> {
  if (!ENV.supabaseServiceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for SSO provisioning",
    );
  }
  const base = supabaseAuthBase();
  const body: Record<string, unknown> = {
    type: input.provider,
    domains: input.domains,
  };
  if (input.metadataUrl) body.metadata_url = input.metadataUrl;
  if (input.clientId) body.client_id = input.clientId;

  const res = await fetch(`${base}/admin/sso/providers`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ENV.supabaseServiceKey}`,
      apikey: ENV.supabaseServiceKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      json.message ||
        json.error ||
        `SSO provider registration failed (${res.status})`,
    );
  }
  return {
    providerId: json.id ?? "",
    acsUrl: `${base}/sso/saml/acs`,
    entityId: `${base}/sso/saml/metadata`,
  };
}

export function supabaseSsoEndpoints() {
  const base = supabaseAuthBase();
  return {
    acsUrl: `${base}/sso/saml/acs`,
    entityId: `${base}/sso/saml/metadata`,
    metadataUrl: `${base}/sso/saml/metadata`,
    sloUrl: `${base}/sso/slo`,
  };
}

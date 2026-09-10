import type { AppForgeIntegrationDefinition } from "./catalog.js";
import type {
  IntegrationConnectionState,
  IntegrationHealth,
} from "./health.js";

type Helpers = {
  value: (name: string) => string;
  any: (...names: string[]) => boolean;
  probe: (
    url: string,
    init?: RequestInit,
  ) => Promise<{ ok: boolean; status: number; message: string }>;
  result: (
    definition: AppForgeIntegrationDefinition,
    state: IntegrationConnectionState,
    message: string,
    configured?: boolean,
    verified?: boolean,
  ) => IntegrationHealth;
};

/** Optional service-account verifiers kept separate for honest runtime checks. */
export async function verifyOptionalServiceAccount(
  definition: AppForgeIntegrationDefinition,
  helpers: Helpers,
): Promise<IntegrationHealth | null> {
  const { value, any, probe, result } = helpers;
  const fail = (message: string, configured = true) =>
    result(definition, "needs_attention", message, configured, false);
  const pass = (message: string) =>
    result(definition, "connected", message, true, true);

  switch (definition.id) {
    case "sentry": {
      const dsn = value("SENTRY_DSN") || value("VITE_SENTRY_DSN");
      const token = value("SENTRY_AUTH_TOKEN") || value("SENTRY_API_TOKEN");
      const org = value("SENTRY_ORG_SLUG") || value("SENTRY_ORG");
      if (!dsn && !token)
        return result(definition, "not_connected", "Sentry is not configured");
      if (!token || !org) {
        return result(
          definition,
          "configuration_required",
          "Sentry DSN alone is not enough for a verified connection; set SENTRY_AUTH_TOKEN and SENTRY_ORG_SLUG for a non-mutating API check",
          true,
        );
      }
      const check = await probe(
        `https://sentry.io/api/0/organizations/${encodeURIComponent(org)}/`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return check.ok ? pass(check.message) : fail(check.message);
    }
    case "cloudflare": {
      const token = value("CLOUDFLARE_API_TOKEN");
      if (!token)
        return result(
          definition,
          "not_connected",
          "CLOUDFLARE_API_TOKEN is not configured",
        );
      const check = await probe(
        "https://api.cloudflare.com/client/v4/user/tokens/verify",
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return check.ok ? pass(check.message) : fail(check.message);
    }
    case "sprites": {
      if (!any("SPRITES_API_TOKEN", "SPRITES_HEALTH_URL")) {
        return result(definition, "not_connected", "Sprites is not configured");
      }
      const healthUrl = value("SPRITES_HEALTH_URL");
      const token = value("SPRITES_API_TOKEN");
      if (!healthUrl || !token) {
        return result(
          definition,
          "configuration_required",
          "Sprites needs an API token and explicit non-mutating health URL before AppForge will mark it connected",
          true,
        );
      }
      const check = await probe(healthUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return check.ok ? pass(check.message) : fail(check.message);
    }
    default:
      return null;
  }
}

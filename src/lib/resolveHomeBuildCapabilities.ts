import type { BuildCapabilityId } from "./buildCapabilities.js";
import { normalizeCapabilities } from "./buildCapabilities.js";
import { inferCapabilitiesFromBrief } from "./creativeOrchestrator.js";

const PRODUCTION_DEFAULT_CAPS: BuildCapabilityId[] = [
  "auth",
  "database",
  "payments",
  "admin",
  "api",
];

/** When Home omits buildCapabilities, infer from prompt + production defaults. */
export function resolveHomeBuildCapabilities(
  description: string,
  explicit?: BuildCapabilityId[] | null,
): BuildCapabilityId[] {
  if (explicit && explicit.length > 0) {
    return normalizeCapabilities(explicit);
  }
  const inferred = inferCapabilitiesFromBrief(description);
  const merged = normalizeCapabilities([
    ...PRODUCTION_DEFAULT_CAPS,
    ...inferred,
  ]);
  return merged.length > 0 ? merged : PRODUCTION_DEFAULT_CAPS;
}

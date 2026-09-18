import type { BuildCapabilityId } from "./buildCapabilities.js";
import { normalizeCapabilities } from "./buildCapabilities.js";
import { inferCapabilitiesFromBrief } from "./creativeOrchestrator.js";
import {
  detectIncomeIntent,
  suggestCapabilitiesForIncome,
} from "./revenueReadiness.js";
import { PRODUCTION_READY_CAPABILITIES } from "./productionPreset.js";

/** When Home omits buildCapabilities, infer from prompt + production defaults. */
export function resolveHomeBuildCapabilities(
  description: string,
  explicit?: BuildCapabilityId[] | string[] | null,
): BuildCapabilityId[] {
  const provided = normalizeCapabilities(explicit ?? []);
  if (provided.length > 0) return provided.slice(0, 10);

  const inferred = inferCapabilitiesFromBrief(description);
  let caps = normalizeCapabilities([
    ...PRODUCTION_READY_CAPABILITIES,
    ...inferred,
  ]);
  if (detectIncomeIntent(description)) {
    caps = suggestCapabilitiesForIncome(caps);
  }
  return caps.slice(0, 10);
}

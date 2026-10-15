import { BUILD_CAPABILITY_IDS } from "../buildCapabilities.js";

export const CORE_BUILDER_RESOURCE_CAPABILITY_IDS = [
  "authentication",
  "account",
  "authorization",
  "database",
  "api",
  "storage",
  "notifications",
  "billing",
  "webhooks",
  "background_jobs",
  "search",
  "analytics",
  "security",
  "observability",
  "monetization",
] as const;

export const BUILDER_RESOURCE_CAPABILITY_IDS = [
  ...BUILD_CAPABILITY_IDS,
  ...CORE_BUILDER_RESOURCE_CAPABILITY_IDS,
] as const;

export type CoreBuilderResourceCapabilityId =
  (typeof CORE_BUILDER_RESOURCE_CAPABILITY_IDS)[number];
export type BuilderResourceCapabilityId =
  (typeof BUILDER_RESOURCE_CAPABILITY_IDS)[number];

export function isBuilderResourceCapabilityId(
  value: string,
): value is BuilderResourceCapabilityId {
  return (BUILDER_RESOURCE_CAPABILITY_IDS as readonly string[]).includes(value);
}

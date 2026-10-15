import {
  BUILTIN_BUILDER_RESOURCES,
  builtinResourceCounts,
} from "./builtinResourceCatalog.js";
import { DESIGN_FAMILY_RESOURCES } from "./designFamilies.js";
import { SUBSTANTIAL_CORE_RESOURCES } from "./substantialCoreResources.js";
import { SUBSTANTIAL_DOMAIN_RESOURCES } from "./substantialDomainResources.js";
import { BuilderResourceRegistry } from "./resourceRegistry.js";

export const ALL_BUILDER_RESOURCES = [
  ...BUILTIN_BUILDER_RESOURCES,
  ...SUBSTANTIAL_CORE_RESOURCES,
  ...SUBSTANTIAL_DOMAIN_RESOURCES,
  ...DESIGN_FAMILY_RESOURCES,
];

export function createBuilderResourceLibraryRegistry(): BuilderResourceRegistry {
  return new BuilderResourceRegistry(ALL_BUILDER_RESOURCES);
}

export function builderResourceLibraryCounts(): {
  total: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  byMaturity: Record<string, number>;
} {
  const byCategory = builtinResourceCounts();
  const byType: Record<string, number> = {};
  const byMaturity: Record<string, number> = {};

  for (const resource of [
    ...SUBSTANTIAL_CORE_RESOURCES,
    ...SUBSTANTIAL_DOMAIN_RESOURCES,
    ...DESIGN_FAMILY_RESOURCES,
  ]) {
    byCategory[resource.identity.category] =
      (byCategory[resource.identity.category] ?? 0) + 1;
  }
  for (const resource of ALL_BUILDER_RESOURCES) {
    byType[resource.identity.resourceType] =
      (byType[resource.identity.resourceType] ?? 0) + 1;
    byMaturity[resource.governance.maturityState] =
      (byMaturity[resource.governance.maturityState] ?? 0) + 1;
  }

  const sortRecord = (value: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
    );

  return {
    total: ALL_BUILDER_RESOURCES.length,
    byCategory: sortRecord(byCategory),
    byType: sortRecord(byType),
    byMaturity: sortRecord(byMaturity),
  };
}

/**
 * Concrete registry of external technology adapters AppForge can orchestrate.
 * Section bodies live in externalTechnologyAdapters_*.ts; this module
 * composes and exports the registry + lookup helpers.
 */
import type {
  AdapterCategory,
  AdapterEvidence,
  TechnologyAdapterDescriptor,
} from "./adapterSdk.js";
import { GAME_ENGINES } from "./externalTechnologyAdapters_GAME_ENGINES.js";
import { MOBILE_DESKTOP_TOOLCHAINS } from "./externalTechnologyAdapters_MOBILE_DESKTOP_TOOLCHAINS.js";
import { CONTENT_TOOLS } from "./externalTechnologyAdapters_CONTENT_TOOLS.js";
import { DATABASES } from "./externalTechnologyAdapters_DATABASES.js";
import { CLOUD_PLATFORMS } from "./externalTechnologyAdapters_CLOUD_PLATFORMS.js";
import { COMPILER_RUNTIMES } from "./externalTechnologyAdapters_COMPILER_RUNTIMES.js";
import { AI_PROVIDERS } from "./externalTechnologyAdapters_AI_PROVIDERS.js";
import { DEPLOYMENT_TARGETS } from "./externalTechnologyAdapters_DEPLOYMENT_TARGETS.js";
import { HARDWARE_TOOLCHAINS } from "./externalTechnologyAdapters_HARDWARE_TOOLCHAINS.js";

/** All external technology adapters AppForge currently knows about. */
export const EXTERNAL_TECHNOLOGY_ADAPTERS: readonly TechnologyAdapterDescriptor[] =
  [
    ...GAME_ENGINES,
    ...MOBILE_DESKTOP_TOOLCHAINS,
    ...CONTENT_TOOLS,
    ...DATABASES,
    ...CLOUD_PLATFORMS,
    ...COMPILER_RUNTIMES,
    ...AI_PROVIDERS,
    ...DEPLOYMENT_TARGETS,
    ...HARDWARE_TOOLCHAINS,
  ];

const BY_ID = new Map(
  EXTERNAL_TECHNOLOGY_ADAPTERS.map((entry) => [entry.id, entry]),
);

export function getExternalTechnologyAdapter(
  id: string,
): TechnologyAdapterDescriptor | undefined {
  return BY_ID.get(id);
}

export function listAdaptersByCategory(
  category: AdapterCategory,
): TechnologyAdapterDescriptor[] {
  return EXTERNAL_TECHNOLOGY_ADAPTERS.filter(
    (entry) => entry.category === category,
  );
}

/** Minimal evidence shape external callers must prove before claiming discovery. */
export function discoveryEvidence(): AdapterEvidence {
  return { discovered: true };
}

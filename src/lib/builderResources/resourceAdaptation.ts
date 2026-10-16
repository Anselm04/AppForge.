import { createHash } from "node:crypto";
import type { BuilderResourceManifest } from "./resourceManifest.js";

export type ResourceAdaptationRequest = {
  resource: BuilderResourceManifest;
  configuration: Record<string, unknown>;
  productId: string;
};

export type ResourceAdaptationChange = {
  path: string;
  value: unknown;
};

export type ResourceAdaptationPlan = {
  resourceId: string;
  resourceVersion: string;
  productId: string;
  changes: ResourceAdaptationChange[];
  adaptationFingerprint: string;
};

function allowedAdaptationPoints(
  resource: BuilderResourceManifest,
): Set<string> {
  return new Set([
    ...resource.adaptation.configurableFields,
    ...resource.adaptation.replacementPoints,
    ...resource.adaptation.brandingHooks,
    ...resource.adaptation.localizationHooks,
    ...resource.adaptation.authorizationHooks,
    ...resource.adaptation.databaseHooks,
    ...resource.adaptation.extensionPoints,
  ]);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

export function adaptBuilderResource(
  request: ResourceAdaptationRequest,
): ResourceAdaptationPlan {
  const productId = request.productId.trim();
  if (!productId) throw new Error("Resource adaptation requires a productId");

  const allowed = allowedAdaptationPoints(request.resource);
  const changes = Object.entries(request.configuration)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, value]) => {
      if (!allowed.has(path)) {
        throw new Error(
          `${path} is not an allowed adaptation point for ${request.resource.identity.resourceId}`,
        );
      }
      return { path, value: stableValue(value) };
    });

  const fingerprintInput = {
    resourceId: request.resource.identity.resourceId,
    resourceVersion: request.resource.identity.version,
    productId,
    changes,
  };
  const adaptationFingerprint = createHash("sha256")
    .update(JSON.stringify(fingerprintInput))
    .digest("hex");

  return {
    resourceId: request.resource.identity.resourceId,
    resourceVersion: request.resource.identity.version,
    productId,
    changes,
    adaptationFingerprint,
  };
}

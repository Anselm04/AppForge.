import type { BuilderResourceManifest } from "./resourceManifest.js";

export type ResourceCompositionConflictKind =
  | "route"
  | "database-migration"
  | "package-version"
  | "state-namespace"
  | "navigation"
  | "missing-dependency"
  | "environment-kind"
  | "api-contract"
  | "event-producer"
  | "permission-policy"
  | "styling-token"
  | "platform-capability"
  | "deployment-policy";

export type ResourceCompositionConflict = {
  kind: ResourceCompositionConflictKind;
  key: string;
  resources: string[];
  values: string[];
};

export type ResourceCompositionPlan = {
  ok: boolean;
  resources: string[];
  routes: string[];
  databaseMigrations: string[];
  environmentVariables: string[];
  packages: Record<string, string>;
  stateNamespaces: string[];
  navigationKeys: string[];
  permissions: string[];
  stylingTokens: string[];
  platformCapabilities: string[];
  deploymentRequirements: string[];
  eventsProduced: string[];
  eventsConsumed: string[];
  apiContracts: Record<string, string>;
  conflicts: ResourceCompositionConflict[];
};

type Ownership = Map<string, string[]>;

type ValueOwnership = Map<string, Map<string, string[]>>;

function identity(resource: BuilderResourceManifest): string {
  return `${resource.identity.resourceId}@${resource.identity.version}`;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function ownershipOf(
  resources: readonly BuilderResourceManifest[],
  values: (resource: BuilderResourceManifest) => readonly string[],
): Ownership {
  const ownership: Ownership = new Map();
  for (const resource of resources) {
    for (const value of values(resource)) {
      const owners = ownership.get(value) ?? [];
      owners.push(identity(resource));
      ownership.set(value, owners);
    }
  }
  return ownership;
}

function collisions(
  kind: ResourceCompositionConflictKind,
  ownership: Ownership,
): ResourceCompositionConflict[] {
  return [...ownership.entries()]
    .filter(([, owners]) => new Set(owners).size > 1)
    .map(([key, owners]) => ({
      kind,
      key,
      resources: sortedUnique(owners),
      values: [key],
    }));
}

function valueOwnershipOf(
  resources: readonly BuilderResourceManifest[],
  values: (resource: BuilderResourceManifest) => Record<string, string>,
): ValueOwnership {
  const ownership: ValueOwnership = new Map();
  for (const resource of resources) {
    for (const [key, value] of Object.entries(values(resource))) {
      const byValue = ownership.get(key) ?? new Map<string, string[]>();
      const owners = byValue.get(value) ?? [];
      owners.push(identity(resource));
      byValue.set(value, owners);
      ownership.set(key, byValue);
    }
  }
  return ownership;
}

function incompatibleValues(
  kind: ResourceCompositionConflictKind,
  ownership: ValueOwnership,
): ResourceCompositionConflict[] {
  return [...ownership.entries()]
    .filter(([, byValue]) => byValue.size > 1)
    .map(([key, byValue]) => ({
      kind,
      key,
      resources: sortedUnique([...byValue.values()].flat()),
      values: [...byValue.keys()].sort((left, right) => left.localeCompare(right)),
    }));
}

function packageConflicts(
  resources: readonly BuilderResourceManifest[],
): ResourceCompositionConflict[] {
  return incompatibleValues(
    "package-version",
    valueOwnershipOf(resources, (resource) => resource.composition.packages),
  );
}

function missingDependencyConflicts(
  resources: readonly BuilderResourceManifest[],
): ResourceCompositionConflict[] {
  const available = new Set(resources.map((resource) => resource.identity.resourceId));
  const conflicts: ResourceCompositionConflict[] = [];
  for (const resource of resources) {
    for (const dependency of resource.capabilities.dependencies) {
      if (!available.has(dependency)) {
        conflicts.push({
          kind: "missing-dependency",
          key: dependency,
          resources: [identity(resource)],
          values: [dependency],
        });
      }
    }
  }
  return conflicts;
}

function mergedRecord(
  resources: readonly BuilderResourceManifest[],
  values: (resource: BuilderResourceManifest) => Record<string, string>,
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const resource of resources) {
    for (const [key, value] of Object.entries(values(resource))) {
      merged[key] ??= value;
    }
  }
  return Object.fromEntries(
    Object.entries(merged).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function composeBuilderResources(
  resources: readonly BuilderResourceManifest[],
): ResourceCompositionPlan {
  const ordered = [...resources].sort((left, right) =>
    identity(left).localeCompare(identity(right)),
  );

  const conflicts = [
    ...collisions(
      "route",
      ownershipOf(ordered, (resource) => resource.composition.routes),
    ),
    ...collisions(
      "database-migration",
      ownershipOf(
        ordered,
        (resource) => resource.composition.databaseMigrations,
      ),
    ),
    ...packageConflicts(ordered),
    ...collisions(
      "state-namespace",
      ownershipOf(ordered, (resource) => resource.composition.stateNamespaces),
    ),
    ...collisions(
      "navigation",
      ownershipOf(ordered, (resource) => resource.composition.navigationKeys),
    ),
    ...missingDependencyConflicts(ordered),
    ...incompatibleValues(
      "environment-kind",
      valueOwnershipOf(
        ordered,
        (resource) => resource.composition.environmentVariableKinds,
      ),
    ),
    ...incompatibleValues(
      "api-contract",
      valueOwnershipOf(ordered, (resource) => resource.composition.apiContracts),
    ),
    ...collisions(
      "event-producer",
      ownershipOf(ordered, (resource) => resource.composition.eventsProduced),
    ),
    ...incompatibleValues(
      "permission-policy",
      valueOwnershipOf(
        ordered,
        (resource) => resource.composition.permissionPolicies,
      ),
    ),
    ...incompatibleValues(
      "styling-token",
      valueOwnershipOf(
        ordered,
        (resource) => resource.composition.stylingAssignments,
      ),
    ),
    ...incompatibleValues(
      "platform-capability",
      valueOwnershipOf(
        ordered,
        (resource) => resource.composition.platformCapabilityPolicies,
      ),
    ),
    ...incompatibleValues(
      "deployment-policy",
      valueOwnershipOf(
        ordered,
        (resource) => resource.composition.deploymentPolicies,
      ),
    ),
  ].sort((left, right) => {
    const kind = left.kind.localeCompare(right.kind);
    return kind !== 0 ? kind : left.key.localeCompare(right.key);
  });

  return {
    ok: conflicts.length === 0,
    resources: ordered.map(identity),
    routes: sortedUnique(
      ordered.flatMap((resource) => resource.composition.routes),
    ),
    databaseMigrations: sortedUnique(
      ordered.flatMap((resource) => resource.composition.databaseMigrations),
    ),
    environmentVariables: sortedUnique(
      ordered.flatMap((resource) => resource.composition.environmentVariables),
    ),
    packages: mergedRecord(ordered, (resource) => resource.composition.packages),
    stateNamespaces: sortedUnique(
      ordered.flatMap((resource) => resource.composition.stateNamespaces),
    ),
    navigationKeys: sortedUnique(
      ordered.flatMap((resource) => resource.composition.navigationKeys),
    ),
    permissions: sortedUnique(
      ordered.flatMap((resource) => resource.composition.permissions),
    ),
    stylingTokens: sortedUnique(
      ordered.flatMap((resource) => resource.composition.stylingTokens),
    ),
    platformCapabilities: sortedUnique(
      ordered.flatMap((resource) => resource.composition.platformCapabilities),
    ),
    deploymentRequirements: sortedUnique(
      ordered.flatMap((resource) => resource.composition.deploymentRequirements),
    ),
    eventsProduced: sortedUnique(
      ordered.flatMap((resource) => resource.composition.eventsProduced),
    ),
    eventsConsumed: sortedUnique(
      ordered.flatMap((resource) => resource.composition.eventsConsumed),
    ),
    apiContracts: mergedRecord(
      ordered,
      (resource) => resource.composition.apiContracts,
    ),
    conflicts,
  };
}

import type { BuilderResourceManifest } from "./resourceManifest.js";

export type ResourceCompositionConflictKind =
  | "route"
  | "database-migration"
  | "package-version"
  | "state-namespace"
  | "navigation";

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
  conflicts: ResourceCompositionConflict[];
};

type Ownership = Map<string, string[]>;

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

function packageConflicts(
  resources: readonly BuilderResourceManifest[],
): ResourceCompositionConflict[] {
  const versions = new Map<string, Map<string, string[]>>();
  for (const resource of resources) {
    for (const [packageName, version] of Object.entries(
      resource.composition.packages,
    )) {
      const byVersion = versions.get(packageName) ?? new Map<string, string[]>();
      const owners = byVersion.get(version) ?? [];
      owners.push(identity(resource));
      byVersion.set(version, owners);
      versions.set(packageName, byVersion);
    }
  }

  return [...versions.entries()]
    .filter(([, byVersion]) => byVersion.size > 1)
    .map(([packageName, byVersion]) => ({
      kind: "package-version" as const,
      key: packageName,
      resources: sortedUnique([...byVersion.values()].flat()),
      values: [...byVersion.keys()].sort((left, right) => left.localeCompare(right)),
    }));
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
  ].sort((left, right) => {
    const kind = left.kind.localeCompare(right.kind);
    return kind !== 0 ? kind : left.key.localeCompare(right.key);
  });

  const packages: Record<string, string> = {};
  for (const resource of ordered) {
    for (const [packageName, version] of Object.entries(
      resource.composition.packages,
    )) {
      packages[packageName] ??= version;
    }
  }

  return {
    ok: conflicts.length === 0,
    resources: ordered.map(identity),
    routes: sortedUnique(ordered.flatMap((resource) => resource.composition.routes)),
    databaseMigrations: sortedUnique(
      ordered.flatMap((resource) => resource.composition.databaseMigrations),
    ),
    environmentVariables: sortedUnique(
      ordered.flatMap((resource) => resource.composition.environmentVariables),
    ),
    packages: Object.fromEntries(
      Object.entries(packages).sort(([left], [right]) => left.localeCompare(right)),
    ),
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
    conflicts,
  };
}

export type UpgradeCandidate = {
  resourceId: string;
  currentVersion: string;
  candidateVersion: string;
  status: "pending-evidence" | "validated" | "rejected";
  productionEvidenceInherited: false;
  requiredEvidence: Array<
    "impact-analysis" | "migration" | "tests" | "behavioral-comparison" | "deployment" | "recovery"
  >;
};

export function createUpgradeCandidate(input: {
  resourceId: string;
  currentVersion: string;
  candidateVersion: string;
}): UpgradeCandidate {
  if (input.currentVersion === input.candidateVersion) {
    throw new Error("Upgrade candidate must change the resource version.");
  }
  return {
    ...input,
    status: "pending-evidence",
    productionEvidenceInherited: false,
    requiredEvidence: [
      "impact-analysis",
      "migration",
      "tests",
      "behavioral-comparison",
      "deployment",
      "recovery",
    ],
  };
}

export type RollbackSurface = {
  codeVersion: boolean;
  databaseVersion: boolean;
  providerConfig: boolean;
  webhooks: boolean;
  jobs: boolean;
  flags: boolean;
  resourceVersions: boolean;
  dataRollbackSafe: boolean;
};

export function assessRollback(surface: RollbackSurface): {
  safe: boolean;
  strategy: "rollback" | "forward-recovery";
  missing: string[];
} {
  const required: Array<[keyof RollbackSurface, string]> = [
    ["codeVersion", "code version"],
    ["databaseVersion", "database version"],
    ["providerConfig", "provider configuration"],
    ["webhooks", "webhook configuration"],
    ["jobs", "background jobs"],
    ["flags", "feature flags"],
    ["resourceVersions", "resource versions"],
  ];
  const missing = required.filter(([key]) => !surface[key]).map(([, label]) => label);
  const safe = missing.length === 0 && surface.dataRollbackSafe;
  return {
    safe,
    strategy: safe ? "rollback" : "forward-recovery",
    missing: surface.dataRollbackSafe ? missing : [...missing, "data rollback safety"],
  };
}

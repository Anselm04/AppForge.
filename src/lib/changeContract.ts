import { createHash } from "node:crypto";

export type ChangeImpactLevel = "none" | "compatible" | "migration" | "breaking";

export type ChangeImpact = {
  level: ChangeImpactLevel;
  notes?: string;
};

export type RollbackImpact = ChangeImpact & {
  safe: boolean;
  strategy: string;
};

export type ChangeContract = {
  version: 1;
  projectId: number;
  originalProductContractHash: string;
  request: string;
  additions: string[];
  changes: string[];
  removals: string[];
  impacts: {
    data: ChangeImpact;
    api: ChangeImpact;
    ui: ChangeImpact;
    platform: ChangeImpact;
    billing: ChangeImpact;
    permissions: ChangeImpact;
    security: ChangeImpact;
    rollback: RollbackImpact;
  };
  createdAt: string;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashProductContract(contract: unknown): string {
  return createHash("sha256").update(stable(contract)).digest("hex");
}

export function createChangeContract(input: {
  projectId: number;
  originalProductContract: unknown;
  request: string;
  additions: string[];
  changes: string[];
  removals: string[];
}): ChangeContract {
  const hasRemoval = input.removals.length > 0;
  const defaultImpact: ChangeImpact = { level: "compatible" };
  return {
    version: 1,
    projectId: input.projectId,
    originalProductContractHash: hashProductContract(input.originalProductContract),
    request: input.request.trim(),
    additions: [...input.additions],
    changes: [...input.changes],
    removals: [...input.removals],
    impacts: {
      data: { level: hasRemoval ? "migration" : "compatible" },
      api: { ...defaultImpact },
      ui: { ...defaultImpact },
      platform: { ...defaultImpact },
      billing: { ...defaultImpact },
      permissions: { ...defaultImpact },
      security: { ...defaultImpact },
      rollback: {
        level: hasRemoval ? "breaking" : "compatible",
        safe: !hasRemoval,
        strategy: hasRemoval
          ? "Forward recovery required until a data-preserving rollback plan is proven."
          : "Restore the previous validated artifact and its recorded resource/provider versions.",
      },
    },
    createdAt: new Date().toISOString(),
  };
}

export function validateChangeContract(contract: ChangeContract): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!contract.request.trim()) errors.push("Change request is required.");
  if (!/^[a-f0-9]{64}$/.test(contract.originalProductContractHash)) {
    errors.push("Original ProductContract hash is invalid.");
  }
  const impactKeys = [
    "data",
    "api",
    "ui",
    "platform",
    "billing",
    "permissions",
    "security",
    "rollback",
  ] as const;
  for (const key of impactKeys) {
    if (!contract.impacts[key]) errors.push(`Missing ${key} impact decision.`);
  }
  if (contract.impacts.rollback.safe && !contract.impacts.rollback.strategy.trim()) {
    errors.push("A safe rollback claim requires a concrete recovery strategy.");
  }
  if (
    contract.removals.length > 0 &&
    contract.impacts.rollback.safe &&
    contract.impacts.rollback.level !== "compatible"
  ) {
    errors.push("Destructive removals cannot be marked rollback-safe without compatible evidence.");
  }
  return { valid: errors.length === 0, errors };
}

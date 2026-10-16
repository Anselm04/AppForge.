export type DatabaseOperationKind =
  | "add_column"
  | "rename_column"
  | "split_column"
  | "change_enum"
  | "add_relationship"
  | "drop_relationship"
  | "drop_column"
  | "add_constraint"
  | "drop_constraint"
  | "add_index"
  | "drop_index"
  | "change_auth_policy";

export type DatabaseMigrationAssessment = {
  safeToApply: boolean;
  destructive: boolean;
  reasons: string[];
  recoveryMode: "rollback" | "forward-fix" | "either";
};

const DESTRUCTIVE = new Set<DatabaseOperationKind>([
  "split_column",
  "change_enum",
  "drop_relationship",
  "drop_column",
  "drop_constraint",
  "drop_index",
  "change_auth_policy",
]);

export function assessDatabaseMigration(input: {
  operations: Array<{ kind: DatabaseOperationKind; target: string }>;
  backupEvidenceId: string | null;
  rollbackPlan: string;
  forwardFixPlan: string;
  seedDataSeparated: boolean;
}): DatabaseMigrationAssessment {
  const reasons: string[] = [];
  const destructive = input.operations.some((operation) =>
    DESTRUCTIVE.has(operation.kind),
  );

  if (input.operations.length === 0)
    reasons.push("Migration has no declared operations.");
  if (destructive && !input.backupEvidenceId?.trim()) {
    reasons.push("Destructive migration requires verified backup evidence.");
  }
  if (!input.seedDataSeparated) {
    reasons.push("Schema migration and seed/demo data must be separated.");
  }
  if (!input.forwardFixPlan.trim()) {
    reasons.push("Every migration requires a forward-fix plan.");
  }
  if (!input.rollbackPlan.trim() && !input.forwardFixPlan.trim()) {
    reasons.push("Migration requires a rollback or forward recovery strategy.");
  }

  const reversible = Boolean(input.rollbackPlan.trim()) && !destructive;
  const recoveryMode: DatabaseMigrationAssessment["recoveryMode"] = reversible
    ? "either"
    : "forward-fix";

  return {
    safeToApply: reasons.length === 0,
    destructive,
    reasons,
    recoveryMode,
  };
}

export function assessApiChange(input: {
  removedFields: string[];
  changedTypes: string[];
  removedEndpoints: string[];
  versionedReplacement: string | null;
}): { breaking: boolean; safeToRelease: boolean; reasons: string[] } {
  const breaking =
    input.removedFields.length > 0 ||
    input.changedTypes.length > 0 ||
    input.removedEndpoints.length > 0;
  const reasons: string[] = [];
  if (breaking && !input.versionedReplacement?.trim()) {
    reasons.push(
      "Breaking API change requires an explicit versioned replacement or compatibility layer.",
    );
  }
  return { breaking, safeToRelease: reasons.length === 0, reasons };
}

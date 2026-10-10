import type { ValidationResult } from "../agents/buildValidator.js";
import { updateProjectFiles, updateProjectStatus } from "../db.js";

/** An unavailable runner cannot be repaired by changing customer source. */
export async function pauseUnavailableValidation(input: {
  projectId: number;
  files: Record<string, string>;
  result: ValidationResult;
  write: (event: string, payload: unknown) => void;
}): Promise<boolean> {
  if (input.result.passed || input.result.stage !== "isolation") return false;

  await updateProjectFiles(input.projectId, { ...input.files });
  await updateProjectStatus(
    input.projectId,
    "paused",
    "validation_unavailable",
  );
  input.write("pause", {
    reason: "validation_unavailable",
    agent: "Validator",
    errors: input.result.errors,
    message:
      "Validation is temporarily unavailable. Your progress is saved. Retry the saved build after an isolated runner is available; no code repair or deployment was attempted.",
  });
  return true;
}

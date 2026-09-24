import {
  productContractSchema,
  type ProductContract,
} from "./productContract.js";
import { requireExplicitStack } from "./stackDefaults.js";

export type ProjectStackSource = {
  techStack?: string | null;
  productContract?: unknown;
};

/**
 * The single rule for "which stack does this existing project use":
 * the canonical product contract's selected stack when the project has a valid
 * contract, otherwise the stack recorded on the project (normalized). A project
 * with neither is rejected — it is never silently treated as React.
 */
export function resolveProjectStack(
  project: ProjectStackSource | null | undefined,
): {
  techStack: string;
  productContract?: ProductContract;
} {
  const parsed = productContractSchema.safeParse(project?.productContract);
  if (parsed.success) {
    return {
      techStack: requireExplicitStack(parsed.data.selectedTechnologyStack),
      productContract: parsed.data,
    };
  }
  return { techStack: requireExplicitStack(project?.techStack) };
}

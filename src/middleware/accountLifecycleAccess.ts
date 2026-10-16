export type AccountLifecycleAccessState = "active" | "pending" | "completed";

export function accountLifecycleAllowsAccess(
  state: AccountLifecycleAccessState,
): boolean {
  return state === "active";
}

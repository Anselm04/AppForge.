import type { BuildLogEntry } from "./buildLogView.js";

export type WorkflowState = "queued" | "running" | "completed" | "failed" | "paused";
export type WorkflowNode = {
  id: string;
  label: string;
  state: WorkflowState;
  detail: string;
};

const stages = [
  { id: "research", label: "Research", aliases: ["researching"], agents: ["Researcher"] },
  { id: "plan", label: "Planning", aliases: ["planning", "architecture"], agents: ["Planner", "Architect"] },
  { id: "generate", label: "Generate source", aliases: ["generating", "persisting", "structured", "generated"], agents: ["Coder"] },
  { id: "verify", label: "Verify and repair", aliases: ["validating", "repairing", "runnable", "behaviorally-verified"], agents: ["Tester", "Reviewer", "Validator"] },
  { id: "preview", label: "Preview", aliases: ["previewing", "browser-verification"], agents: ["Preview"] },
  { id: "deliver", label: "Delivery readiness", aliases: ["deployment", "deployment-verified", "monetization", "monetization-verified", "production-candidate", "production-certified"], agents: ["Deployer"] },
] as const;

type Snapshot = {
  status?: string | null;
  buildStage?: string | null;
  pauseReason?: string | null;
};

/**
 * View projection only. No node is marked complete solely because another
 * phase started: a log, authoritative stage or terminal result must support it.
 */
export function projectWorkflow(snapshot: Snapshot, logs: BuildLogEntry[]): WorkflowNode[] {
  const current = stages.findIndex((stage) => stage.aliases.some((alias) => alias === snapshot.buildStage));
  const terminal = snapshot.status === "validated" || snapshot.status === "production-certified";
  const failed = snapshot.status === "failed";
  const paused = snapshot.status === "paused";

  return stages.map((stage, index) => {
    const evidence = logs.filter((log) =>
      stage.agents.some((name) => name.toLowerCase() === log.agent?.toLowerCase()) ||
      (typeof log.payload?.stage === "string" && stage.aliases.some((alias) => alias === log.payload?.stage))
    );
    const last = evidence.at(-1);
    const explicitComplete = evidence.some((log) => ["task_complete", "complete"].includes(log.type) || log.payload?.passed === true);
    const explicitFailure = last?.type === "error" || last?.payload?.passed === false;
    let state: WorkflowState = "queued";
    if (explicitComplete) state = "completed";
    if (snapshot.status === "running" && current === index) state = "running";
    if (snapshot.status === "running" && current < 0 && last && !explicitComplete) state = "running";
    if (failed && (current === index || explicitFailure)) state = "failed";
    if (paused && current === index) state = "paused";
    if (terminal && stage.id === "verify") state = "completed";
    if (snapshot.status === "production-certified" && stage.id === "deliver") state = "completed";
    if (explicitFailure && !explicitComplete) state = "failed";
    return {
      id: stage.id,
      label: stage.label,
      state,
      detail: last?.payload?.message?.slice(0, 180) ??
        (state === "running" ? "Real build activity in progress" :
         state === "paused" ? snapshot.pauseReason ?? "Waiting for action" :
         state === "completed" ? "Stage evidence recorded" : "Awaiting recorded activity"),
    };
  });
}

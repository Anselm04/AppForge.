import type { BuildLogEntry } from "./buildLogView.js";

export type TaskFlowState = "running" | "completed" | "failed" | "paused";
export type TaskFlowNode = {
  id: string;
  label: string;
  owner: string;
  module: string;
  state: TaskFlowState;
  filenames: string[];
  detail: string;
  attempt: number | null;
};

/** Keep compact task evidence independent of the 200-row token display log. */
export function appendTaskFlowEvent(
  previous: readonly BuildLogEntry[],
  incoming: BuildLogEntry,
): BuildLogEntry[] {
  const taskId = incoming.payload?.taskId;
  if (incoming.agent !== "Coder" || typeof taskId !== "string" || !taskId.trim())
    return [...previous];
  if (!["coordination_status", "chunk", "task_complete", "task_resume_skip"].includes(incoming.type))
    return [...previous];
  // One chunk indicates the task streamed code; actual text stays in Logs.
  if (incoming.type === "chunk" &&
      previous.some((item) => item.type === "chunk" && item.payload?.taskId === taskId))
    return [...previous];
  return [...previous, incoming].slice(-512);
}

const MAX_TASKS = 24;
const DISPLAY_LIMIT = 90;
const safeText = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, DISPLAY_LIMIT)
    : fallback;

/** Build task nodes ONLY from real task-specific agent events. */
export function buildTaskFlow(
  logs: readonly BuildLogEntry[],
  projectStatus: string | null | undefined,
): TaskFlowNode[] {
  const tasks = new Map<string, TaskFlowNode>();
  for (const log of logs) {
    if (log.agent !== "Coder") continue;
    const payload = log.payload;
    if (!payload) continue;
    const taskId = payload?.taskId;
    if (typeof taskId !== "string" || !taskId.trim()) continue;
    if (
      ![
        "coordination_status",
        "chunk",
        "task_complete",
        "task_resume_skip",
      ].includes(log.type)
    )
      continue;
    let item = tasks.get(taskId);
    if (!item) {
      item = {
        id: taskId,
        label: safeText(payload?.ownerAgent, "Engineering task"),
        owner: safeText(payload?.ownerAgent, "Coder"),
        module: safeText(payload?.module, "Application"),
        state: "running",
        filenames: [],
        detail: "Task activity recorded",
        attempt: null,
      };
      tasks.set(taskId, item);
    }
    if (payload?.ownerAgent) {
      item.owner = safeText(payload.ownerAgent, item.owner);
      item.label = item.owner;
    }
    if (payload?.module) item.module = safeText(payload.module, item.module);
    if (
      typeof payload?.attempt === "number" &&
      Number.isFinite(payload.attempt)
    )
      item.attempt = Math.max(1, Math.floor(payload.attempt));
    if (log.type === "task_complete" || log.type === "task_resume_skip") {
      item.state = "completed";
      item.detail =
        log.type === "task_resume_skip"
          ? "Previously completed task reused"
          : "Generated task output recorded";
      if (
        typeof payload.filename === "string" &&
        payload.filename.trim() &&
        !item.filenames.includes(payload.filename)
      ) {
        item.filenames.push(payload.filename.slice(0, 240));
      }
    } else if (log.type === "coordination_status" && payload?.error) {
      item.state = "failed";
      item.detail = safeText(payload.error, "Task error recorded");
    } else if (item.state !== "completed") {
      item.state = "running";
      item.detail =
        log.type === "chunk"
          ? "Receiving generated source"
          : "Specialist task active";
    }
  }

  const all = [...tasks.values()];
  // A bounded visual view, not the source of truth. Completed tasks remain in
  // the existing server log; this merely limits how many boxes are painted.
  return all.slice(-MAX_TASKS).map((item) => ({
    ...item,
    state:
      projectStatus === "paused" && item.state === "running"
        ? ("paused" as const)
        : projectStatus === "failed" && item.state === "running"
          ? ("failed" as const)
          : projectStatus !== "running" && item.state === "running"
            ? ("paused" as const)
            : item.state,
  }));
}

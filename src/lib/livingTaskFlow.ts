import type { BuildLogEntry } from "./buildLogView.js";

export type TaskFlowState =
  "queued" | "running" | "completed" | "failed" | "paused";
export type TaskFlowNode = {
  id: string;
  label: string;
  owner: string;
  module: string;
  state: TaskFlowState;
  filenames: string[];
  dependencies: string[];
  detail: string;
  attempt: number | null;
};

/** Keep compact task evidence independent of the 200-row token display log. */
export function appendTaskFlowEvent(
  previous: BuildLogEntry[],
  incoming: BuildLogEntry,
): BuildLogEntry[] {
  const taskId = incoming.payload?.taskId;
  if (
    incoming.agent !== "Coder" ||
    typeof taskId !== "string" ||
    !taskId.trim() ||
    ![
      "coordination_status",
      "chunk",
      "task_complete",
      "task_resume_skip",
    ].includes(incoming.type)
  )
    return previous;

  // Do not allow reconnect replay to generate duplicate milestones.
  const signature = (event: BuildLogEntry): string =>
    JSON.stringify([
      event.agent,
      event.type,
      event.payload?.taskId,
      event.payload?.attempt,
      event.payload?.filename,
      event.payload?.error,
      event.payload?.message,
      event.payload?.dependencies,
    ]);
  if (incoming.type === "chunk") {
    if (
      previous.some(
        (event) => event.type === "chunk" && event.payload?.taskId === taskId,
      )
    ) {
      return previous;
    }
  } else if (
    previous.some((event) => signature(event) === signature(incoming))
  ) {
    return previous;
  }

  // Preserve final milestones for all tasks under streaming pressure: remove
  // the oldest nonterminal events first. This is a bounded display cache,
  // not a replacement for the persisted backend event history.
  const next = [...previous, incoming];
  if (next.length <= 512) return next;
  const nonterminal = next.findIndex(
    (event) => event.type === "chunk" || event.type === "coordination_status",
  );
  if (nonterminal >= 0) next.splice(nonterminal, 1);
  else next.shift();
  return next;
}

export type PlannedTask = {
  id: string;
  agent: string;
  module: string;
  sequence: number;
  dependencies: string[];
};

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
  plannedTasks: readonly PlannedTask[] = [],
): TaskFlowNode[] {
  const tasks = new Map<string, TaskFlowNode>();
  for (const plan of [...plannedTasks].sort(
    (a, b) => a.sequence - b.sequence,
  )) {
    if (typeof plan.id !== "string" || !plan.id.trim() || tasks.has(plan.id))
      continue;
    tasks.set(plan.id, {
      id: plan.id,
      label: safeText(plan.agent, "Engineering task"),
      owner: safeText(plan.agent, "Coder"),
      module: safeText(plan.module, "Application"),
      state: "queued",
      dependencies: [
        ...new Set(
          (plan.dependencies ?? []).filter(
            (dep) => typeof dep === "string" && dep.trim() && dep !== plan.id,
          ),
        ),
      ].slice(0, 32),
      filenames: [],
      detail: "Planned task — no execution event yet",
      attempt: null,
    });
  }
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
        dependencies: [],
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
    if (Array.isArray(payload.dependencies)) {
      item.dependencies = [
        ...new Set(
          payload.dependencies
            .filter(
              (id): id is string =>
                typeof id === "string" && id.trim().length > 0 && id !== taskId,
            )
            .map((id) => id.slice(0, 160)),
        ),
      ].slice(0, 32);
    }
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

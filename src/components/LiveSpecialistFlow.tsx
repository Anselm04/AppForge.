import type { BuildLogEntry } from "../lib/buildLogView.js";
import { buildTaskFlow, type TaskFlowState } from "../lib/livingTaskFlow.js";
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";

const classes: Record<TaskFlowState, string> = {
  running: "border-sky-300 bg-sky-50 text-sky-900",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-900",
  failed: "border-rose-200 bg-rose-50 text-rose-900",
  paused: "border-amber-200 bg-amber-50 text-amber-900",
};

type Connector = { from: string; to: string; path: string };
type Layout = { width: number; height: number; connectors: Connector[] };

/** Measure actual rendered cards so dependency arrows remain correct on mobile. */
function useTaskConnectors(
  graph: RefObject<HTMLDivElement>,
  keys: string,
  dependencies: readonly { id: string; dependencies: string[] }[],
): Layout {
  const [layout, setLayout] = useState<Layout>({ width: 0, height: 0, connectors: [] });
  useEffect(() => {
    const root = graph.current;
    if (!root) return;
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      const buttons = new Map(
        [...root.querySelectorAll<HTMLButtonElement>("[data-task-node]")].map((button) => [
          button.dataset.taskNode ?? "",
          button.getBoundingClientRect(),
        ]),
      );
      const connectors: Connector[] = [];
      for (const task of dependencies) {
        const target = buttons.get(task.id);
        if (!target) continue;
        for (const parentId of task.dependencies) {
          const source = buttons.get(parentId);
          if (!source) continue;
          const sameRow = Math.abs(source.top - target.top) < 40;
          let startX: number, startY: number, endX: number, endY: number;
          if (sameRow) {
            const forward = source.left < target.left;
            startX = (forward ? source.right : source.left) - bounds.left;
            endX = (forward ? target.left : target.right) - bounds.left;
            startY = source.top + source.height / 2 - bounds.top;
            endY = target.top + target.height / 2 - bounds.top;
          } else {
            const forward = source.top < target.top;
            startX = source.left + source.width / 2 - bounds.left;
            endX = target.left + target.width / 2 - bounds.left;
            startY = (forward ? source.bottom : source.top) - bounds.top;
            endY = (forward ? target.top : target.bottom) - bounds.top;
          }
          const path = sameRow
            ? `M ${startX} ${startY} C ${(startX + endX) / 2} ${startY}, ${(startX + endX) / 2} ${endY}, ${endX} ${endY}`
            : `M ${startX} ${startY} C ${startX} ${(startY + endY) / 2}, ${endX} ${(startY + endY) / 2}, ${endX} ${endY}`;
          connectors.push({ from: parentId, to: task.id, path });
        }
      }
      setLayout({ width: bounds.width, height: bounds.height, connectors: connectors.slice(0, 48) });
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure);
    observer?.observe(root);
    root.querySelectorAll("[data-task-node]").forEach((node) => observer?.observe(node));
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, [graph, keys, dependencies]);
  return layout;
}

/**
 * Real specialist tasks only. The cards are created by task-specific events
 * from the existing pipeline; no timer, sample tasks or synthetic completion.
 */
export function LiveSpecialistFlow({
  logs,
  projectStatus,
}: {
  logs: BuildLogEntry[];
  projectStatus?: string | null;
}) {
  const tasks = useMemo(
    () => buildTaskFlow(logs, projectStatus),
    [logs, projectStatus],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const focused = tasks.find((task) => task.id === selected);
  const graphRef = useRef<HTMLDivElement>(null);
  const marker = useId().replace(/:/g, "");
  const graphKeys = tasks.map((task) => `${task.id}:${task.dependencies.join(",")}`).join("|");
  const layout = useTaskConnectors(graphRef, graphKeys, tasks);
  const taskIndex = new Map(tasks.map((task) => [task.id, task]));


  if (tasks.length === 0) {
    return (
      <div className="mt-5 rounded-2xl border border-dashed border-sky-200 bg-white/70 p-4 text-sm text-slate-600">
        Specialist task connections appear here as real task events arrive.
        There are no recorded specialist tasks in the current activity window.
      </div>
    );
  }

  return (
    <div
      className="mt-6 rounded-2xl border border-sky-100 bg-white/80 p-4 md:p-5"
      data-testid="live-specialist-flow"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Specialist engineering flow
          </h3>
          <p className="text-xs text-slate-600">
            Every box represents a task ID received from AppForge's agent
            pipeline.
          </p>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-800">
          {tasks.length} recorded task{tasks.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="flex flex-col items-center" aria-hidden="true">
        <span className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-900">
          Generate source
        </span>
        <span className="h-5 w-px bg-sky-200" />
        <span className="text-sky-500">↓</span>
      </div>
      <div ref={graphRef} className="relative">
        {layout.width > 0 && layout.connectors.length > 0 && (
          <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            aria-hidden="true">
            <defs>
              <marker id={marker} markerWidth="7" markerHeight="7"
                refX="6" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0 0 L7 3.5 L0 7 Z" fill="#7dd3fc" />
              </marker>
            </defs>
            {layout.connectors.map((edge) => {
              const destination = taskIndex.get(edge.to);
              const origin = taskIndex.get(edge.from);
              const active = origin?.state === "completed" && destination?.state === "running";
              return (
                <g key={`${edge.from}:${edge.to}`}>
                  <path d={edge.path} stroke={active ? "#38bdf8" : "#cbd5e1"}
                    strokeWidth={active ? 2.5 : 1.5} fill="none"
                    markerEnd={`url(#${marker})`}
                    className={active ? "motion-safe:animate-pulse" : ""}/>
                  {active && (
                    <circle r="3" fill="#0ea5e9" className="motion-reduce:hidden">
                      <animateMotion dur="1.7s" repeatCount="indefinite" path={edge.path} />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        <div
          className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2 xl:grid-cols-3"
          role="list"
          aria-label="Recorded engineering tasks"
        >
        {tasks.map((task) => (
          <div key={task.id} role="listitem" className="min-w-0">
            <div className="flex justify-center" aria-hidden="true">
              <span
                className={`mb-1 h-4 w-1 rounded-full ${task.state === "running" ? "bg-sky-400 motion-safe:animate-pulse" : "bg-slate-200"}`}
              />
            </div>
            <button
              type="button"
              data-task-node={task.id}
              onClick={() => setSelected(task.id)}
              aria-pressed={selected === task.id}
              className={`relative z-10 w-full rounded-xl border p-3 text-left shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${classes[task.state]} ${selected === task.id ? "ring-2 ring-sky-300" : ""}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold">
                  {task.label}
                </span>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${task.state === "running" ? "bg-sky-500 motion-safe:animate-pulse" : task.state === "completed" ? "bg-emerald-500" : task.state === "failed" ? "bg-rose-500" : "bg-amber-500"}`}
                  aria-hidden="true"
                />
              </span>
              <span className="mt-1 block truncate text-xs opacity-80">
                {task.module}
              </span>
              <span className="mt-2 block text-xs capitalize">
                {task.state}
              </span>
            </button>
          </div>
        ))}
        </div>
      </div>
      {focused && (
        <div
          className="mt-4 rounded-xl border border-sky-100 bg-sky-50/70 p-4"
          aria-live="polite"
        >
          <div className="text-sm font-semibold text-slate-900">
            {focused.owner} · {focused.module}
          </div>
          <p className="mt-1 text-xs text-slate-700">
            Task ID: <code className="break-all">{focused.id}</code>
          </p>
          <p className="mt-1 text-sm text-slate-700">{focused.detail}</p>
          {focused.dependencies.length > 0 && (
            <p className="mt-2 break-words text-xs text-sky-800">
              Incoming task dependencies: {focused.dependencies.join(" → ")}
            </p>
          )}
          {focused.attempt && (
            <p className="mt-1 text-xs text-slate-600">
              Recorded attempt: {focused.attempt}
            </p>
          )}
          {focused.filenames.length > 0 && (
            <div className="mt-3 text-xs text-slate-700">
              <p className="font-semibold">
                Generated files recorded for this task:
              </p>
              <ul className="mt-1 max-h-36 list-disc overflow-auto pl-5">
                {focused.filenames.map((name) => (
                  <li className="break-all" key={name}>
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

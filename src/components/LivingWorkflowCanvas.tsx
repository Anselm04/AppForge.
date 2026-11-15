import { useMemo, useState } from "react";
import { LiveSpecialistFlow } from "./LiveSpecialistFlow.js";
import type { BuildLogEntry } from "../lib/buildLogView.js";
import { projectWorkflow, type WorkflowState } from "../lib/livingWorkflow.js";
import type { PlannedTask } from "../lib/livingTaskFlow.js";
import { BuildLivePreview } from "./BuildLivePreview.js";
import { isProjectArtifactReady } from "../lib/buildStatus.js";

const statusStyles: Record<WorkflowState, string> = {
  queued: "border-slate-200 bg-white text-slate-500",
  running:
    "border-sky-300 bg-sky-50 text-sky-900 shadow-[0_0_26px_rgba(56,189,248,.12)]",
  completed: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
  failed: "border-rose-300 bg-rose-50 text-rose-900",
  paused: "border-amber-300 bg-amber-50 text-amber-900",
};

export function LivingWorkflowCanvas({
  project,
  logs,
  taskLogs,
  plannedTasks,
  projectId,
  deployUrl,
  browserPreviewUrl,
}: {
  project: {
    status?: string | null;
    buildStage?: string | null;
    pauseReason?: string | null;
  };
  logs: BuildLogEntry[];
  taskLogs?: BuildLogEntry[];
  plannedTasks?: readonly PlannedTask[];
  projectId: number;
  deployUrl?: string | null;
  browserPreviewUrl?: string | null;
}) {
  const nodes = useMemo(() => projectWorkflow(project, logs), [project, logs]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const previewReady = isProjectArtifactReady(project.status);
  const active =
    nodes.find((node) => node.id === selected) ??
    nodes.find((node) => node.state === "running") ??
    nodes[0];

  return (
    <section
      aria-label="AppForge living build workflow"
      data-testid="living-workflow-canvas"
      className="mb-6 overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-white via-sky-50/70 to-violet-50/40 p-4 text-slate-800 shadow-sm md:p-7"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-sky-700">
            AppForge · Live Build
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            Living Workflow Canvas
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Connected to the actual build state and received agent events.
          </p>
        </div>
        <span
          aria-live="polite"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
        >
          {project.status === "running"
            ? "● Build active"
            : `Build: ${project.status ?? "unknown"}`}
        </span>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(230px,.65fr)]">
        <ol
          className="relative mx-auto w-full max-w-lg list-none space-y-0"
          aria-label="Build stages in execution order"
        >
          {nodes.map((node, index) => {
            const next = nodes[index + 1];
            const flowing =
              node.state === "completed" && next?.state === "running";
            return (
              <li key={node.id} className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setSelected(node.id)}
                  aria-pressed={active.id === node.id}
                  className={`w-full rounded-2xl border px-5 py-3 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${statusStyles[node.state]} ${active.id === node.id ? "ring-2 ring-sky-300/50" : ""}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">{node.label}</span>
                    <span className="text-xs capitalize">{node.state}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs opacity-80">
                    {node.detail}
                  </span>
                </button>
                {next && (
                  <div
                    aria-hidden="true"
                    className="relative flex h-9 w-6 justify-center"
                  >
                    <span
                      className={`h-full w-px ${flowing ? "bg-sky-400" : "bg-slate-200"}`}
                    />
                    {flowing && (
                      <span className="absolute left-1/2 top-1 -ml-1 h-2 w-2 rounded-full bg-sky-500 motion-safe:animate-bounce motion-reduce:animate-none" />
                    )}
                    <span
                      className={`absolute bottom-0 text-base leading-none ${flowing ? "text-sky-500" : "text-slate-300"}`}
                    >
                      ↓
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <aside
          className="self-start rounded-2xl border border-white bg-white/85 p-5 shadow-sm"
          aria-label="Selected stage details"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700">
            Inspect stage
          </p>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">
            {active.label}
          </h3>
          <p className="mt-1 text-sm capitalize text-slate-600">
            Status: {active.state}
          </p>
          <p className="mt-3 break-words text-sm leading-6 text-slate-700">
            {active.detail}
          </p>
          <p className="mt-5 text-xs leading-5 text-slate-500">
            An arrow animates only when the source stage has recorded completion
            and the next stage is running. Open the existing Logs, Evidence and
            Preview tabs for detailed proof and generated output.
          </p>
        </aside>
      </div>
      <LiveSpecialistFlow
        logs={taskLogs ?? logs}
        projectStatus={project.status}
        plannedTasks={plannedTasks}
      />
      <div className="mt-5 overflow-hidden rounded-2xl border border-sky-100 bg-white/85 p-4 md:p-5"
        data-testid="living-workflow-preview">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Product preview</h3>
            <p className="mt-1 text-sm text-slate-600">
              {previewReady
                ? "The validated application is available for inspection."
                : "The interactive product preview becomes available after build validation."}
            </p>
          </div>
          <button type="button" disabled={!previewReady}
            onClick={() => setShowPreview((value) => !value)}
            className="rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 disabled:cursor-not-allowed disabled:opacity-50">
            {showPreview && previewReady ? "Hide preview" : "Open live preview"}
          </button>
        </div>
        {showPreview && previewReady && (
          <div className="mt-4" data-testid="living-workflow-preview-content">
            <BuildLivePreview projectId={projectId} deployUrl={deployUrl}
              browserPreviewUrl={browserPreviewUrl} enabled={true} />
          </div>
        )}
      </div>
    </section>
  );
}

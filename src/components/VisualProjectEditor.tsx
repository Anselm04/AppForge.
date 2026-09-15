import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { emitPreviewUpdate } from "../lib/previewEvents.js";
import { trpc } from "../utils/trpc.js";

type Props = {
  projectId: number;
  enabled?: boolean;
};

type VisualSelection = {
  id: string | null;
  tag: string;
  text: string | null;
  hasNestedMarkup: boolean;
  styles: {
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontWeight: string;
    textAlign: string;
    padding: string;
    margin: string;
    borderRadius: string;
    width: string;
    height: string;
  };
};

type EditableStyleKey = keyof VisualSelection["styles"];

const STYLE_FIELDS: Array<{ key: EditableStyleKey; label: string }> = [
  { key: "color", label: "Text color" },
  { key: "backgroundColor", label: "Background" },
  { key: "fontSize", label: "Font size" },
  { key: "fontWeight", label: "Font weight" },
  { key: "textAlign", label: "Text align" },
  { key: "padding", label: "Padding" },
  { key: "margin", label: "Margin" },
  { key: "borderRadius", label: "Corner radius" },
  { key: "width", label: "Width" },
  { key: "height", label: "Height" },
];

function isVisualSelection(value: unknown): value is VisualSelection & {
  type: "appforge:visual-select";
} {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    data.type === "appforge:visual-select" &&
    (data.id === null || typeof data.id === "string") &&
    typeof data.tag === "string" &&
    typeof data.hasNestedMarkup === "boolean" &&
    !!data.styles &&
    typeof data.styles === "object"
  );
}

export function VisualProjectEditor({ projectId, enabled = true }: Props) {
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selection, setSelection] = useState<VisualSelection | null>(null);
  const [text, setText] = useState("");
  const [styles, setStyles] = useState<VisualSelection["styles"] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: files, isLoading } = useQuery({
    queryKey: ["projects", projectId, "files"],
    queryFn: () => trpc.projects.getFiles.query({ id: projectId }),
    enabled: enabled && projectId > 0,
  });

  const { data: snapshots } = useQuery({
    queryKey: ["projects", projectId, "snapshots"],
    queryFn: () => trpc.projects.snapshots.query({ projectId }),
    enabled: enabled && projectId > 0,
  });

  const staticHtmlEligible = Boolean(
    files?.["index.html"] &&
    !files?.["package.json"] &&
    !files?.["vite.config.ts"] &&
    !files?.["vite.config.js"],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isVisualSelection(event.data)) return;
      const next: VisualSelection = {
        id: event.data.id,
        tag: event.data.tag,
        text: event.data.text,
        hasNestedMarkup: event.data.hasNestedMarkup,
        styles: event.data.styles,
      };
      setSelection(next);
      setText(next.text ?? "");
      setStyles(next.styles);
      setNotice(
        next.id
          ? null
          : "This element has no HTML id. Add an id in the Code tab before editing it visually.",
      );
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const rollback = useMutation({
    mutationFn: (snapshotId: number) =>
      trpc.projects.rollback.mutate({ projectId, snapshotId }),
    onSuccess: (result) => {
      setNotice(
        `Restored version ${result.version}${result.label ? ` — ${result.label}` : ""}.`,
      );
      setSelection(null);
      setStyles(null);
      setRefreshKey((value) => value + 1);
      void queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "files"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "snapshots"],
      });
      emitPreviewUpdate(projectId, { paths: ["index.html"], source: "editor" });
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Restore failed");
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!selection?.id || !styles)
        throw new Error("Select an editable element");
      return trpc.visualEditor.edit.mutate({
        projectId,
        path: "index.html",
        targetId: selection.id,
        text:
          selection.hasNestedMarkup || selection.text === null
            ? undefined
            : text,
        styles,
      });
    },
    onSuccess: (result) => {
      setNotice(
        `Saved as version ${result.version}. You can roll back from version history.`,
      );
      setSelection(null);
      setStyles(null);
      setRefreshKey((value) => value + 1);
      void queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "files"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "snapshots"],
      });
      emitPreviewUpdate(projectId, {
        paths: ["index.html"],
        source: "editor",
      });
    },
    onError: (error) => {
      setNotice(error instanceof Error ? error.message : "Visual edit failed");
    },
  });

  if (!enabled || projectId <= 0) {
    return (
      <p className="text-slate-400 text-sm">
        Design tools appear after files are generated.
      </p>
    );
  }
  if (isLoading) {
    return <p className="text-slate-400 text-sm">Loading design workspace…</p>;
  }
  if (!staticHtmlEligible) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm text-slate-300">
        <p className="font-semibold text-white">
          Visual editing is guarded for this project type.
        </p>
        <p className="mt-2">
          Direct click-to-edit currently supports static HTML projects. React,
          Vue, Svelte, and other bundled apps keep using the Code and Chat tabs
          until source-to-DOM mapping can be applied without guessing at
          generated source.
        </p>
      </div>
    );
  }

  const previewSrc = `/apps/${projectId}?appforgeVisual=1&v=${refreshKey}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
      <div className="min-h-[520px] rounded-lg border border-slate-700 overflow-hidden bg-white">
        <iframe
          ref={iframeRef}
          key={previewSrc}
          src={previewSrc}
          title="Visual app editor"
          className="w-full min-h-[520px] h-full"
          sandbox="allow-scripts allow-forms allow-modals allow-popups"
        />
      </div>
      <aside className="rounded-lg border border-slate-700 bg-slate-800 p-4 text-sm text-slate-200">
        <h2 className="font-semibold text-white text-lg">Design inspector</h2>
        <p className="text-slate-400 mt-1 mb-4">
          Click an element in the preview to edit it.
        </p>
        {!selection ? (
          <p className="text-slate-400">No element selected.</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded bg-slate-900 p-2 font-mono text-xs">
              &lt;{selection.tag}
              {selection.id ? ` id="${selection.id}"` : ""}&gt;
            </div>
            {!selection.hasNestedMarkup && selection.text !== null && (
              <label className="block">
                <span className="text-xs text-slate-400">Text</span>
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={2000}
                  rows={3}
                  className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-2 text-white"
                />
              </label>
            )}
            {selection.hasNestedMarkup && (
              <p className="text-xs text-amber-300">
                Nested content is protected from text replacement; styles can
                still be changed.
              </p>
            )}
            {styles &&
              STYLE_FIELDS.map(({ key, label }) => (
                <label className="block" key={key}>
                  <span className="text-xs text-slate-400">{label}</span>
                  <input
                    value={styles[key]}
                    onChange={(event) =>
                      setStyles((current) =>
                        current
                          ? { ...current, [key]: event.target.value }
                          : current,
                      )
                    }
                    maxLength={120}
                    className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-white"
                  />
                </label>
              ))}
            <button
              type="button"
              disabled={!selection.id || !styles || save.isPending}
              onClick={() => save.mutate()}
              className="w-full rounded bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-4 py-2 font-medium text-white"
            >
              {save.isPending ? "Saving…" : "Save visual change"}
            </button>
          </div>
        )}
        {notice && <p className="mt-4 text-xs text-amber-300">{notice}</p>}
        <div className="mt-6 border-t border-slate-700 pt-4">
          <h3 className="font-semibold text-white">Version history</h3>
          <div className="mt-2 max-h-56 space-y-2 overflow-auto">
            {(snapshots ?? []).slice(0, 10).map((snapshot) => (
              <div
                key={snapshot.id}
                className="flex items-center justify-between gap-2 rounded bg-slate-900 p-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-200">
                    v{snapshot.version} — {snapshot.label || "Snapshot"}
                  </p>
                  {snapshot.isCurrent && (
                    <span className="text-[11px] text-green-400">Current</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!!snapshot.isCurrent || rollback.isPending}
                  onClick={() => rollback.mutate(snapshot.id)}
                  className="shrink-0 rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600 disabled:opacity-50"
                >
                  Restore
                </button>
              </div>
            ))}
            {(snapshots ?? []).length === 0 && (
              <p className="text-xs text-slate-500">No snapshots yet.</p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

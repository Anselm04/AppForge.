import { useState, useEffect, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.default })),
);

type Props = {
  projectId: number;
  enabled?: boolean;
};

function languageForPath(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".jsx")) return "typescript";
  if (path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".js") || path.endsWith(".mjs")) return "javascript";
  if (path.endsWith(".json")) return "json";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html") || path.endsWith(".htm")) return "html";
  if (path.endsWith(".md")) return "markdown";
  if (path.endsWith(".py")) return "python";
  if (path.endsWith(".sql")) return "sql";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  if (path.endsWith(".svg")) return "xml";
  return "plaintext";
}

export function ProjectCodeEditor({ projectId, enabled = true }: Props) {
  const queryClient = useQueryClient();
  const { data: files, isLoading } = useQuery({
    queryKey: ["projects", projectId, "files"],
    queryFn: () => trpc.projects.getFiles.query({ id: projectId }),
    enabled: enabled && projectId > 0,
  });

  const paths = files ? Object.keys(files).sort() : [];
  const [selected, setSelected] = useState<string | null>(null);
  const activePath = selected ?? paths[0] ?? null;
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (activePath && files?.[activePath] !== undefined) {
      setDraft(files[activePath] ?? "");
    }
  }, [activePath, files]);

  const save = useMutation({
    mutationFn: (payload: { path: string; content: string }) =>
      trpc.projects.updateFile.mutate({ id: projectId, ...payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "files"],
      });
    },
  });

  if (isLoading) {
    return <p className="text-slate-400 text-sm">Loading files…</p>;
  }
  if (!files || paths.length === 0) {
    return (
      <p className="text-slate-400 text-sm">
        Files appear here when the build generates code.
      </p>
    );
  }

  const content = activePath ? (files[activePath] ?? "") : "";
  const editorValue = draft || content;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 min-h-[320px]">
      <ul className="bg-slate-800 border border-slate-700 rounded-lg overflow-auto max-h-[480px] text-sm">
        {paths.map((path) => (
          <li key={path}>
            <button
              type="button"
              onClick={() => {
                setSelected(path);
                setDraft(files[path] ?? "");
              }}
              className={`w-full text-left px-3 py-2 truncate \${
                path === activePath
                  ? "bg-blue-900/50 text-blue-200"
                  : "text-slate-300 hover:bg-slate-700"
              }`}
            >
              {path}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <div className="text-xs text-slate-400 font-mono">{activePath}</div>
        <div className="min-h-[360px] border border-slate-700 rounded-lg overflow-hidden">
          <Suspense
            fallback={
              <textarea
                className="w-full h-[360px] font-mono text-xs bg-slate-950 text-slate-200 p-3"
                value={editorValue}
                onChange={(e) => setDraft(e.target.value)}
              />
            }
          >
            <MonacoEditor
              height="360px"
              theme="vs-dark"
              language={activePath ? languageForPath(activePath) : "plaintext"}
              value={editorValue}
              onChange={(value) => setDraft(value ?? "")}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </Suspense>
        </div>
        <button
          type="button"
          disabled={!activePath || save.isPending}
          onClick={() => {
            if (!activePath) return;
            save.mutate({ path: activePath, content: draft || content });
          }}
          className="self-start bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
        >
          {save.isPending ? "Saving…" : "Save file"}
        </button>
      </div>
    </div>
  );
}

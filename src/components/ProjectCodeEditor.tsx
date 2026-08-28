import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

type Props = {
  projectId: number;
  enabled?: boolean;
};

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

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-3 min-h-[320px]">
      <ul className="bg-slate-800 border border-slate-700 rounded-lg overflow-auto max-h-[420px] text-sm">
        {paths.map((path) => (
          <li key={path}>
            <button
              type="button"
              onClick={() => {
                setSelected(path);
                setDraft(files[path] ?? "");
              }}
              className={`w-full text-left px-3 py-2 truncate ${
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
        <textarea
          className="flex-1 min-h-[280px] font-mono text-xs bg-slate-950 text-slate-200 border border-slate-700 rounded-lg p-3"
          value={draft || content}
          onChange={(e) => setDraft(e.target.value)}
        />
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

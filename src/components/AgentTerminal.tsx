import { useEffect, useRef, useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { emitPreviewUpdate } from "../lib/previewEvents.js";
import { useWebContainerSandbox } from "../hooks/useWebContainerSandbox.js";

type Props = {
  projectId: number;
  enabled?: boolean;
};

type TerminalLine = {
  id: number;
  text: string;
  kind: "info" | "cmd" | "out" | "err";
};

export function AgentTerminal({ projectId, enabled = true }: Props) {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 0,
      text: "AppForge sandbox — WebContainer (browser) + server micro-VM fallback",
      kind: "info",
    },
  ]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"auto" | "browser" | "server">("auto");
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastLogId = useRef(0);

  const appendLine = useCallback((text: string, kind: TerminalLine["kind"]) => {
    setLines((prev) => [...prev, { id: nextId.current++, text, kind }]);
  }, []);

  const { data: files } = useQuery({
    queryKey: ["projects", projectId, "files"],
    queryFn: () => trpc.projects.getFiles.query({ id: projectId }),
    enabled: enabled && projectId > 0,
  });

  const {
    ready: wcReady,
    supported: wcSupported,
    exec: wcExec,
  } = useWebContainerSandbox(projectId, files, (text, kind) =>
    appendLine(text, kind),
  );

  useEffect(() => {
    if (!enabled || projectId <= 0) return;
    void trpc.sandbox.ensure.mutate({ projectId });
  }, [enabled, projectId]);

  const { data: streamLogs } = useQuery({
    queryKey: ["sandbox", projectId, "logs"],
    queryFn: () =>
      trpc.sandbox.logs.query({ projectId, sinceId: lastLogId.current }),
    enabled: enabled && projectId > 0 && mode !== "browser",
    refetchInterval: 1500,
  });

  useEffect(() => {
    if (!streamLogs?.length) return;
    for (const line of streamLogs) {
      if (line.id <= lastLogId.current) continue;
      appendLine(line.text, line.kind);
      lastLogId.current = Math.max(lastLogId.current, line.id);
    }
  }, [streamLogs, appendLine]);

  const exec = useMutation({
    mutationFn: (command: string) =>
      trpc.sandbox.exec.mutate({ projectId, command }),
    onSuccess: (result, command) => {
      for (const line of result.lines) {
        if (line.id <= lastLogId.current) continue;
        appendLine(line.text, line.kind);
        lastLogId.current = Math.max(lastLogId.current, line.id);
      }
      if (command.includes("npm run dev") || command.includes("vite")) {
        emitPreviewUpdate(projectId, { source: "sandbox" });
      }
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const runCommand = async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed || exec.isPending) return;
    appendLine(`$ ${trimmed}`, "cmd");

    const preferBrowser =
      mode === "browser" || (mode === "auto" && wcReady && wcSupported);
    if (preferBrowser && wcReady) {
      const ok = await wcExec(trimmed);
      if (ok) {
        if (trimmed.includes("npm run dev")) {
          emitPreviewUpdate(projectId, { source: "sandbox" });
        }
        setInput("");
        return;
      }
    }

    exec.mutate(trimmed);
    setInput("");
  };

  const color = (kind: TerminalLine["kind"]) => {
    if (kind === "cmd") return "text-green-400";
    if (kind === "err") return "text-red-400";
    if (kind === "info") return "text-slate-400";
    return "text-slate-200";
  };

  return (
    <div className="flex flex-col h-[420px] bg-black border border-slate-700 rounded-lg font-mono text-xs">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800 text-[10px] text-slate-400">
        <span>
          {wcReady
            ? "WebContainer active"
            : wcSupported === false
              ? "Server sandbox only"
              : "Booting WebContainer…"}
        </span>
        <select
          className="ml-auto bg-slate-900 border border-slate-700 rounded px-2 py-0.5"
          value={mode}
          onChange={(e) =>
            setMode(e.target.value as "auto" | "browser" | "server")
          }
        >
          <option value="auto">Auto (browser → server)</option>
          <option value="browser">Browser only</option>
          <option value="server">Server only</option>
        </select>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-1">
        {lines.map((line) => (
          <div key={line.id} className={color(line.kind)}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        className="flex border-t border-slate-700"
        onSubmit={(e) => {
          e.preventDefault();
          void runCommand(input);
        }}
      >
        <span className="px-3 py-2 text-green-500">$</span>
        <input
          className="flex-1 bg-transparent text-slate-200 outline-none py-2 pr-3"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="npm run dev"
          spellCheck={false}
          disabled={exec.isPending}
        />
      </form>
    </div>
  );
}

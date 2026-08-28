import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

type Props = { projectId: number; enabled?: boolean };

type TerminalLine = { id: number; text: string; kind: "info" | "cmd" | "out" | "err" };

export function AgentTerminal({ projectId, enabled = true }: Props) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, text: "AppForge sandbox terminal (read-only log)", kind: "info" },
  ]);
  const [input, setInput] = useState("");
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: logs } = useQuery({
    queryKey: ["projects", projectId, "logs"],
    queryFn: () => trpc.projects.getLogs.query({ projectId }),
    enabled: enabled && projectId > 0,
    refetchInterval: 5000,
  });
  useEffect(() => {
    if (!logs?.length) return;
    const latest = logs[logs.length - 1];
    const text = latest.content?.slice(0, 500) ?? "";
    if (!text) return;
    setLines((prev) => {
      const last = prev[prev.length - 1];
      if (last?.text === text) return prev;
      return [...prev, { id: nextId.current++, text: `[${latest.agent}] ${text}`, kind: "out" as const }];
    });
  }, [logs]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);
  const runCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    setLines((prev) => [...prev, { id: nextId.current++, text: `$ ${trimmed}`, kind: "cmd" }]);
    if (trimmed === "help") setLines((prev) => [...prev, { id: nextId.current++, text: "Commands: help, logs, validate, clear", kind: "info" }]);
    else if (trimmed === "clear") setLines([{ id: nextId.current++, text: "Terminal cleared", kind: "info" }]);
    else setLines((prev) => [...prev, { id: nextId.current++, text: "Sandbox exec not available in browser", kind: "err" }]);
    setInput("");
  };
  const color = (kind: TerminalLine["kind"]) => kind === "cmd" ? "text-green-400" : kind === "err" ? "text-red-400" : kind === "info" ? "text-slate-400" : "text-slate-200";
  return (
    <div className="flex flex-col h-[420px] bg-black border border-slate-700 rounded-lg font-mono text-xs">
      <div className="flex-1 overflow-auto p-3 space-y-1">
        {lines.map((line) => (<div key={line.id} className={color(line.kind)}>{line.text}</div>))}
        <div ref={bottomRef} />
      </div>
      <form className="flex border-t border-slate-700" onSubmit={(e) => { e.preventDefault(); runCommand(input); }}>
        <span className="px-3 py-2 text-green-500">$</span>
        <input className="flex-1 bg-transparent text-slate-200 outline-none py-2 pr-3" value={input} onChange={(e) => setInput(e.target.value)} placeholder="help" spellCheck={false} />
      </form>
    </div>
  );
}

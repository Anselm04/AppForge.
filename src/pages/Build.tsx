import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc";
import { EventSource } from "eventsource";

export function Build() {
  const { projectId } = useParams<{ projectId: string }>();
  const [logs, setLogs] = useState<any[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => trpc.projects.get.query({ id: parseInt(projectId!) }),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!projectId) return;

    const eventSource = new EventSource(
      `/api/build/${projectId}?stream=true`
    );

    eventSource.addEventListener("agent", (event) => {
      const data = JSON.parse(event.data);
      setLogs((prev) => [...prev, data]);
    });

    eventSource.addEventListener("done", (event) => {
      setIsComplete(true);
      eventSource.close();
    });

    eventSource.addEventListener("error", (event) => {
      const data = JSON.parse(event.data);
      setError(data.message);
      eventSource.close();
    });

    return () => eventSource.close();
  }, [projectId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Building your app...</h1>

        {/* Agent Progress */}
        <div className="space-y-4">
          {logs.map((log, idx) => (
            <AgentLogItem key={idx} log={log} />
          ))}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-8 bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Success */}
        {isComplete && !error && (
          <div className="mt-8 bg-green-900/30 border border-green-800 rounded-lg p-4 text-green-300">
            <p className="font-semibold text-lg">✅ App generation complete!</p>
            <p className="mt-2">Your app is ready. Click below to preview or export to GitHub.</p>
            <div className="mt-4 space-x-4">
              <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg">
                Preview
              </button>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
                Export to GitHub
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentLogItem({ log }: any) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center justify-between hover:bg-slate-600/50 p-2 rounded"
      >
        <div>
          <p className="font-semibold text-white">{log.agent}</p>
          <p className="text-sm text-slate-300">{log.payload?.message}</p>
        </div>
        <span className="text-slate-400">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && log.payload?.text && (
        <div className="mt-4 bg-slate-800 p-3 rounded text-slate-300 text-sm font-mono overflow-auto max-h-64">
          {log.payload.text}
        </div>
      )}
    </div>
  );
}

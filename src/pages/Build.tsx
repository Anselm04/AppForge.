import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

interface BuildLog {
  agent: string;
  type: string;
  payload?: {
    message?: string;
    type?: string;
    text?: string;
    spent?: number;
    creditsSpent?: number;
  };
}

interface ProjectData {
  id: number;
  title: string;
  techStack: string;
  status: string;
}

export function Build() {
  const { projectId } = useParams<{ projectId: string }>();
  const [logs, setLogs] = useState<BuildLog[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [deploying, setDeploying] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);

  const { data: project } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => trpc.projects.get.query({ id: parseInt(projectId!) }),
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!projectId) return;

    const eventSource = new EventSource(`/api/build/${projectId}`);

    eventSource.addEventListener("agent", (event: MessageEvent) => {
      const data = JSON.parse(event.data) as BuildLog;
      setLogs((prev) => [...prev, data]);
    });

    eventSource.addEventListener("pause", (event: MessageEvent) => {
      const data = JSON.parse(event.data) as BuildLog;
      setIsPaused(true);
      setLogs((prev) => [...prev, { agent: "System", type: "pause", payload: data.payload }]);
      setCreditsSpent(data.payload?.spent || 0);
    });

    eventSource.addEventListener("done", (event: MessageEvent) => {
      const data = JSON.parse(event.data) as BuildLog;
      setIsComplete(true);
      if (data.payload?.creditsSpent) setCreditsSpent(data.payload.creditsSpent);
      eventSource.close();
    });

    eventSource.addEventListener("error", (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as BuildLog;
        setError(data.payload?.message ?? "Build stream error");
      } catch {
        setError("Build stream error");
      }
      eventSource.close();
    });

    return () => eventSource.close();
  }, [projectId]);

  const handleDeploy = async () => {
    if (!projectId) return;
    setDeploying(true);
    try {
      const result = await trpc.projects.deploy.mutate({ id: parseInt(projectId) });
      setDeployUrl(result.deployUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setDeploying(false);
    }
  };

  const handleGitHubExport = async () => {
    if (!projectId || !project?.title) return;
    const repoName = `appforge-${project.title.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30)}`;
    try {
      const result = await trpc.github.pushToRepo.mutate({
        projectId: parseInt(projectId),
        repoName,
      });
      window.open(result.repoUrl, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "GitHub export failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Building your app...</h1>
        {project && (
          <p className="text-slate-400 mb-8">{project.title} — {project.techStack}</p>
        )}

        {/* Agent Progress */}
        <div className="space-y-4 mb-8">
          {logs.map((log, idx) => (
            <AgentLogItem key={idx} log={log} />
          ))}
        </div>

        {/* Credits Info */}
        {creditsSpent > 0 && (
          <div className="mb-4 text-slate-400 text-sm">
            Credits spent on this build: {creditsSpent}
          </div>
        )}

        {/* Pause / Credit exhausted */}
        {isPaused && (
          <div className="mt-8 bg-amber-900/30 border border-amber-800 rounded-lg p-4 text-amber-300">
            <p className="font-semibold text-lg">⏸️ Build Paused</p>
            <p className="mt-2">Your credits ran out. Purchase more credits to resume the build.</p>
            <div className="mt-4">
              <button
                onClick={() => window.location.href = "/pricing"}
                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg"
              >
                Buy Credits
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-8 bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {/* Success / Complete */}
        {isComplete && !error && !isPaused && (
          <div className="mt-8 bg-green-900/30 border border-green-800 rounded-lg p-4 text-green-300">
            <p className="font-semibold text-lg">✅ App generation complete!</p>
            <p className="mt-2">Your app is ready. You can preview it, deploy to Vercel, or export to GitHub.</p>
            <div className="mt-4 space-x-4 flex flex-wrap gap-4">
              {deployUrl ? (
                <a
                  href={deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg inline-block"
                >
                  🚀 View Live App
                </a>
              ) : (
                <button
                  onClick={handleDeploy}
                  disabled={deploying}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg"
                >
                  {deploying ? "Deploying..." : "🚀 Deploy to Vercel"}
                </button>
              )}
              <button
                onClick={handleGitHubExport}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
              >
                📦 Export to GitHub
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentLogItem({ log }: { log: BuildLog }) {
  const [expanded, setExpanded] = useState(false);

  const isSystem = log.agent === "System";
  const isError = log.type === "error";
  const isPause = log.type === "pause";

  return (
    <div className={`rounded-lg p-4 border ${isError ? "bg-red-900/20 border-red-700" : isPause ? "bg-amber-900/20 border-amber-700" : "bg-slate-700 border-slate-600"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center justify-between hover:bg-slate-600/50 p-2 rounded"
      >
        <div>
          <p className="font-semibold text-white">{isSystem ? "⚙️ System" : log.agent}</p>
          <p className="text-sm text-slate-300">{log.payload?.message || log.payload?.type}</p>
        </div>
        <span className="text-slate-400">{expanded ? "▼" : "▶"}</span>
      </button>
      {expanded && log.payload?.text && (
        <div className="mt-4 bg-slate-800 p-3 rounded text-slate-300 text-sm font-mono overflow-auto max-h-64 whitespace-pre-wrap">
          {log.payload.text}
        </div>
      )}
    </div>
  );
}

export default Build;

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { authedUrl } from "../lib/auth.js";
import { CreditsPauseBanner } from "../components/CreditsPauseBanner.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { ProjectCodeEditor } from "../components/ProjectCodeEditor.js";
import { ProjectChat } from "../components/ProjectChat.js";
import { DeployWizard } from "../components/DeployWizard.js";
import { BuildLivePreview } from "../components/BuildLivePreview.js";
import { AgentTerminal } from "../components/AgentTerminal.js";

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

type DeployDestination =
  "vercel" | "netlify" | "fly" | "preview" | "github-pages";

type BuildTab = "logs" | "code" | "chat" | "preview" | "terminal";

export function Build() {
  const { projectId } = useParams<{ projectId: string }>();
  const pid = parseInt(projectId ?? "0", 10);
  const [tab, setTab] = useState<BuildTab>("logs");
  const [logs, setLogs] = useState<BuildLog[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditsSpent, setCreditsSpent] = useState(0);
  const [deploying, setDeploying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deployUrl, setDeployUrl] = useState<string | null>(null);
  const [deployGuide, setDeployGuide] = useState<string[] | undefined>();
  const [destination, setDestination] = useState<DeployDestination>("preview");

  const { data: project } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => trpc.projects.get.query({ id: pid }),
    enabled: pid > 0,
  });

  const { data: tierStatus } = useQuery({
    queryKey: ["projects", "tierStatus"],
    queryFn: () => trpc.projects.tierStatus.query(),
  });

  const { data: deployOptions } = useQuery({
    queryKey: ["projects", "deployOptions"],
    queryFn: () => trpc.projects.deployOptions.query(),
  });

  const creditBalance = tierStatus?.credits ?? 0;
  const unlimited = !!tierStatus?.unlimited;
  const outOfCredits =
    tierStatus !== undefined && !unlimited && creditBalance < BUILD_CREDIT_COST;

  useEffect(() => {
    if (!projectId || pid <= 0) return;
    if (tierStatus === undefined) return;
    if (!unlimited && creditBalance < BUILD_CREDIT_COST) {
      setIsPaused(true);
      return;
    }

    const eventSource = new EventSource(authedUrl(`/api/build/${projectId}`));

    eventSource.addEventListener("agent", (event: MessageEvent) => {
      const data = JSON.parse(event.data) as BuildLog;
      setLogs((prev) => [...prev, data]);
    });

    eventSource.addEventListener("pause", (event: MessageEvent) => {
      const data = JSON.parse(event.data) as BuildLog;
      setIsPaused(true);
      setLogs((prev) => [
        ...prev,
        { agent: "System", type: "pause", payload: data.payload },
      ]);
      setCreditsSpent(data.payload?.spent || 0);
    });

    eventSource.addEventListener("done", (event: MessageEvent) => {
      const data = JSON.parse(event.data) as {
        payload?: { creditsSpent?: number };
        creditsSpent?: number;
      };
      setIsComplete(true);
      const spent = data.payload?.creditsSpent ?? data.creditsSpent;
      if (spent) setCreditsSpent(spent);
      eventSource.close();
    });

    eventSource.addEventListener("error", async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as {
          message?: string;
          error?: string;
          reason?: string;
        };
        const msg = data?.message ?? "";
        if (
          data?.error === "credits_exhausted" ||
          data?.reason === "credits_exhausted" ||
          /credit/i.test(msg)
        ) {
          setIsPaused(true);
        } else if (msg) {
          setError(msg);
        }
      } catch {
        setError("Build stream error");
      }
      eventSource.close();
    });

    return () => eventSource.close();
  }, [projectId, pid, tierStatus, creditBalance, unlimited]);

  const handleDeploy = async () => {
    if (!projectId) return;
    setDeploying(true);
    try {
      const result = await trpc.projects.deploy.mutate({
        id: pid,
        destination,
      });
      if (result.deployUrl) setDeployUrl(result.deployUrl);
      if ("deployGuide" in result && Array.isArray(result.deployGuide)) {
        setDeployGuide(result.deployGuide as string[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
    } finally {
      setDeploying(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!projectId) return;
    setDownloading(true);
    try {
      const result = await trpc.projects.download.query({ id: pid });
      const binary = atob(result.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename || "appforge-app.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ZIP download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleGitHubExport = async () => {
    if (!projectId || !project?.title) return;
    try {
      const conn = await trpc.github.connectionStatus.query();
      if (!conn.connected) {
        const { url } = await trpc.github.connectUrl.query();
        if (!url) {
          setError("GitHub OAuth is not configured");
          return;
        }
        window.location.href = url;
        return;
      }
      const repoName = `appforge-${project.title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .slice(0, 30)}`;
      const result = await trpc.github.pushToRepo.mutate({
        projectId: pid,
        repoName,
      });
      window.open(result.repoUrl, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "GitHub export failed");
    }
  };

  const destinationDisabled = (dest: DeployDestination): boolean => {
    if (dest === "preview") return false;
    const opt = deployOptions?.[dest];
    return opt ? !opt.configured : false;
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">
          {isComplete ? "Build complete" : "Building your app…"}
        </h1>
        {project && (
          <p className="text-slate-400 mb-4">
            {project.title} — {project.techStack}
            {project.status === "running" && (
              <span className="ml-2 text-amber-400 text-sm">
                (runs in background — safe to refresh)
              </span>
            )}
          </p>
        )}

        <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2">
          {(["logs", "preview", "code", "chat", "terminal"] as BuildTab[]).map(
            (t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-t-lg text-sm font-medium capitalize ${
                  tab === t
                    ? "bg-slate-700 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {t}
              </button>
            ),
          )}
        </div>

        {tab === "logs" && (
          <div className="space-y-4 mb-8">
            {logs.map((log, idx) => (
              <AgentLogItem key={idx} log={log} />
            ))}
            {logs.length === 0 && !error && (
              <p className="text-slate-500 text-sm">
                Waiting for build events…
              </p>
            )}
          </div>
        )}

        {tab === "preview" && pid > 0 && (
          <BuildLivePreview
            projectId={pid}
            deployUrl={deployUrl}
            enabled={isComplete}
          />
        )}

        {tab === "code" && pid > 0 && (
          <ProjectCodeEditor projectId={pid} enabled={isComplete} />
        )}

        {tab === "chat" && pid > 0 && <ProjectChat projectId={pid} />}

        {tab === "terminal" && pid > 0 && (
          <AgentTerminal projectId={pid} enabled={isComplete} />
        )}

        {creditsSpent > 0 && (
          <div className="mb-4 text-slate-400 text-sm">
            Credits spent on this build: {creditsSpent}
          </div>
        )}

        {(isPaused || outOfCredits) && (
          <CreditsPauseBanner
            credits={creditBalance}
            cost={BUILD_CREDIT_COST}
            action="run this build"
          />
        )}

        {error && (
          <div className="mt-8 bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}

        {isComplete && !error && !isPaused && (
          <div className="mt-8 bg-green-900/30 border border-green-800 rounded-lg p-4 text-green-300">
            <p className="font-semibold text-lg">App generation complete!</p>
            <p className="mt-2">
              Edit files in the Code tab, iterate in Chat, then deploy.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="text-sm text-green-200/80">
                Destination{" "}
                <select
                  value={destination}
                  onChange={(e) =>
                    setDestination(e.target.value as DeployDestination)
                  }
                  className="ml-2 bg-slate-800 border border-slate-600 text-white rounded px-2 py-1"
                >
                  <option value="preview">Preview</option>
                  <option
                    value="vercel"
                    disabled={destinationDisabled("vercel")}
                  >
                    Vercel
                  </option>
                  <option
                    value="netlify"
                    disabled={destinationDisabled("netlify")}
                  >
                    Netlify
                  </option>
                  <option value="fly" disabled={destinationDisabled("fly")}>
                    Fly.io
                  </option>
                  <option
                    value="github-pages"
                    disabled={destinationDisabled("github-pages")}
                  >
                    GitHub Pages
                  </option>
                </select>
              </label>
              {deployUrl ? (
                <a
                  href={deployUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg inline-block"
                >
                  View Live App
                </a>
              ) : (
                <button
                  onClick={handleDeploy}
                  disabled={deploying || destinationDisabled(destination)}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg"
                >
                  {deploying ? "Deploying…" : "Deploy"}
                </button>
              )}
              <button
                onClick={handleDownloadZip}
                disabled={downloading}
                className="bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 text-white px-6 py-2 rounded-lg"
              >
                {downloading ? "Preparing ZIP…" : "Download ZIP"}
              </button>
              <button
                onClick={handleGitHubExport}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
              >
                Export to GitHub
              </button>
            </div>
            <DeployWizard
              projectId={pid}
              deployUrl={deployUrl}
              deployGuide={deployGuide}
              techStack={project?.techStack}
            />
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
    <div
      className={`rounded-lg p-4 border ${isError ? "bg-red-900/20 border-red-700" : isPause ? "bg-amber-900/20 border-amber-700" : "bg-slate-700 border-slate-600"}`}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center justify-between hover:bg-slate-600/50 p-2 rounded"
      >
        <div>
          <p className="font-semibold text-white">
            {isSystem ? "System" : log.agent}
          </p>
          <p className="text-sm text-slate-300">
            {log.payload?.message || log.payload?.type}
          </p>
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

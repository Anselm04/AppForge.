import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

type Props = {
  projectId?: number;
  deployUrl?: string | null;
  deployGuide?: string[];
  techStack?: string | null;
};

export function DeployWizard({
  projectId,
  deployUrl,
  deployGuide,
  techStack,
}: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const { data: envVars } = useQuery({
    queryKey: ["projects", projectId, "envVars"],
    queryFn: () => trpc.projects.requiredEnvVars.query({ id: projectId! }),
    enabled: !!projectId && projectId > 0,
  });

  const { data: revenue } = useQuery({
    queryKey: ["projects", projectId, "revenueReadiness"],
    queryFn: () => trpc.projects.revenueReadiness.query({ id: projectId! }),
    enabled: !!projectId && projectId > 0,
  });

  const { data: dbSetup } = useQuery({
    queryKey: ["projects", projectId, "databaseSetup"],
    queryFn: () => trpc.projects.databaseSetup.query({ id: projectId! }),
    enabled: !!projectId && projectId > 0,
  });

  const healthCheck = useMutation({
    mutationFn: (url: string) =>
      trpc.projects.deployHealth.mutate({ id: projectId!, url }),
  });

  if (!deployUrl && (!deployGuide || deployGuide.length === 0) && !projectId) {
    return null;
  }

  const copyEnv = async (key: string) => {
    await navigator.clipboard.writeText(`${key}=`);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="mt-4 bg-slate-800/80 border border-slate-600 rounded-lg p-4 text-slate-200">
      <h3 className="font-semibold text-lg mb-2">Deploy next steps</h3>
      {deployUrl && (
        <div className="text-sm mb-3 space-y-2">
          <p>
            Live URL:{" "}
            <a
              href={deployUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 underline"
            >
              {deployUrl}
            </a>
          </p>
          {projectId && (
            <button
              type="button"
              onClick={() => healthCheck.mutate(deployUrl)}
              disabled={healthCheck.isPending}
              className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded"
            >
              {healthCheck.isPending ? "Checking…" : "Run health check"}
            </button>
          )}
          {healthCheck.data && (
            <p
              className={`text-xs ${healthCheck.data.ok ? "text-green-400" : "text-amber-400"}`}
            >
              {healthCheck.data.ok
                ? `Healthy (${healthCheck.data.statusCode}, ${healthCheck.data.latencyMs}ms)`
                : `Unhealthy: ${healthCheck.data.error ?? `HTTP ${healthCheck.data.statusCode}`}`}
            </p>
          )}
        </div>
      )}
      {techStack && (
        <p className="text-xs text-slate-400 mb-3">Stack: {techStack}</p>
      )}

      {envVars && envVars.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-slate-300 mb-2">
            Environment variables to configure
          </h4>
          <ul className="space-y-1 text-sm">
            {envVars.map((key) => (
              <li
                key={key}
                className="flex items-center justify-between bg-slate-900/50 rounded px-2 py-1 font-mono text-xs"
              >
                <span>{key}</span>
                <button
                  type="button"
                  onClick={() => void copyEnv(key)}
                  className="text-blue-400 hover:text-blue-300 ml-2"
                >
                  {copied === key ? "Copied" : "Copy"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
        {(
          deployGuide ?? [
            "Set DATABASE_URL and API keys on your host.",
            "Run npm install && npm run build locally to verify.",
            "Configure auth callback URLs for Supabase/OAuth.",
            "Read REVIEW.md for AI-flagged issues.",
          ]
        ).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      {dbSetup && (
        <div className="mt-4 pt-4 border-t border-slate-600">
          <h4 className="text-sm font-medium text-sky-300 mb-2">
            Database setup ({dbSetup.label})
          </h4>
          <p className="text-xs text-slate-500 mb-2 font-mono">
            {dbSetup.migrationCommand}
          </p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-400">
            {dbSetup.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <a
            href={dbSetup.consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-blue-400 hover:underline"
          >
            Open {dbSetup.label} console
          </a>
        </div>
      )}

      {revenue?.stripeDetected && revenue.goLiveSteps.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-600">
          <h4 className="text-sm font-medium text-emerald-300 mb-2">
            Stripe go-live (after deploy)
          </h4>
          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-400">
            {revenue.goLiveSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

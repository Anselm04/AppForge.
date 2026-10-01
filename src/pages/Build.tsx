import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { consumeAuthedSse } from "../lib/authedSse.js";
import { CreditsPauseBanner } from "../components/CreditsPauseBanner.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { isOwnerEmail } from "../lib/ownerIdentity.js";
import { ProjectCodeEditor } from "../components/ProjectCodeEditor.js";
import { ProjectChat } from "../components/ProjectChat.js";
import { DeployWizard } from "../components/DeployWizard.js";
import { RevenueReadinessPanel } from "../components/RevenueReadinessPanel.js";
import { BuildLivePreview } from "../components/BuildLivePreview.js";
import { AgentTerminal } from "../components/AgentTerminal.js";
import {
  completedBuildUrl,
  stackPresentation,
} from "../lib/stackPresentation.js";
import { buildStageLabel, outputMaturityLabel } from "../lib/buildStatus.js";

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

type DeployDestination = "vercel" | "netlify" | "fly" | "preview";

type BuildTab = "logs" | "evidence" | "code" | "chat" | "preview" | "terminal";

export function normalizeLiveProductUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

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
  const [structuralDone, setStructuralDone] = useState(false);
  const [deployGuide, setDeployGuide] = useState<string[] | undefined>();
  const [destination, setDestination] = useState<DeployDestination>("preview");
  const [hasPartialFiles, setHasPartialFiles] = useState(false);
  const [planRevision, setPlanRevision] = useState("");
  const [approvalBusy, setApprovalBusy] = useState(false);

  const { data: project, refetch: refetchProject } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => trpc.projects.get.query({ id: pid }),
    enabled: pid > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "production-certified" ||
        status === "validated" ||
        status === "failed"
        ? false
        : 2000;
    },
  });

  const { data: tierStatus } = useQuery({
    queryKey: ["projects", "tierStatus"],
    queryFn: () => trpc.projects.tierStatus.query(),
  });

  const { data: deployOptions } = useQuery({
    queryKey: ["projects", projectId, "deployOptions"],
    queryFn: () => trpc.projects.deployOptions.query({ id: pid }),
    enabled: pid > 0,
  });

  const { data: me } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
  });

  const {
    data: evidence,
    isLoading: evidenceLoading,
    isError: evidenceError,
  } = useQuery({
    queryKey: ["projects", pid, "evidence"],
    queryFn: () => trpc.projects.evidence.query({ id: pid }),
    enabled: pid > 0 && tab === "evidence",
  });

  const creditBalance = tierStatus?.credits ?? 0;
  const ownerUnlimited = !!me?.isOwner || isOwnerEmail(me?.email);
  const unlimited = !!tierStatus?.unlimited || ownerUnlimited;
  const outOfCredits =
    !ownerUnlimited &&
    tierStatus !== undefined &&
    !unlimited &&
    creditBalance < BUILD_CREDIT_COST;

  useEffect(() => {
    if (!projectId || pid <= 0) return;

    // Start the authenticated build stream immediately. Access and credit
    // enforcement belongs to the server. Previously this page waited for the
    // secondary tierStatus query, so a slow/stale account-status request could
    // leave a valid project stuck on "Waiting for build events" forever.
    const effectAc = new AbortController();
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let streamAc: AbortController | null = null;
    let authReconnectAttempts = 0;

    const connect = () => {
      if (closed || effectAc.signal.aborted) return;
      streamAc?.abort();
      streamAc = new AbortController();
      const thisStream = streamAc;
      const onEffectAbort = () => thisStream.abort();
      effectAc.signal.addEventListener("abort", onEffectAbort, { once: true });

      const handleEvent = (event: string, raw: string) => {
        if (closed) return;
        authReconnectAttempts = 0;
        setError(null);
        if (event === "agent") {
          const data = JSON.parse(raw) as BuildLog;
          setLogs((prev) => [...prev, data]);
          if (
            data.agent === "Coder" &&
            (data.type === "task_complete" || data.type === "complete")
          ) {
            setHasPartialFiles(true);
          }
          return;
        }
        if (event === "files_partial") {
          setHasPartialFiles(true);
          return;
        }
        if (event === "pause") {
          let reason = "";
          let message = "";
          let spent = 0;
          try {
            const data = JSON.parse(raw) as {
              reason?: string;
              message?: string;
              spent?: number;
              payload?: {
                reason?: string;
                message?: string;
                spent?: number;
                text?: string;
              };
            };
            reason = data.reason ?? data.payload?.reason ?? "";
            message =
              data.message ?? data.payload?.message ?? data.payload?.text ?? "";
            spent = data.spent ?? data.payload?.spent ?? 0;
          } catch {
            /* ignore parse errors */
          }

          setLogs((prev) => [
            ...prev,
            {
              agent: "System",
              type: "pause",
              payload: { message: message || reason, type: reason },
            },
          ]);
          if (spent) setCreditsSpent(spent);

          const retryable =
            reason === "retry_after_error" ||
            reason === "still_building" ||
            reason.startsWith("still_building");
          if (retryable) {
            setIsPaused(false);
            setError(null);
            thisStream.abort();
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              if (!closed && !effectAc.signal.aborted) connect();
            }, 3000);
            return;
          }

          setIsPaused(true);
          return;
        }
        if (event === "done") {
          const data = JSON.parse(raw) as {
            payload?: {
              creditsSpent?: number;
              liveUrl?: string;
              structuralOnly?: boolean;
            };
            creditsSpent?: number;
            liveUrl?: string;
            structuralOnly?: boolean;
          };
          setIsComplete(true);
          void refetchProject();
          const spent = data.payload?.creditsSpent ?? data.creditsSpent;
          if (spent) setCreditsSpent(spent);
          const structuralOnly =
            data.structuralOnly === true ||
            data.payload?.structuralOnly === true;
          if (structuralOnly) setStructuralDone(true);
          // Structural-only builds never open or claim a live URL.
          const live = normalizeLiveProductUrl(
            structuralOnly
              ? undefined
              : (data.liveUrl ?? data.payload?.liveUrl),
          );
          if (live) {
            setDeployUrl(live);
            closed = true;
            thisStream.abort();
            window.location.assign(live);
            return;
          }
          setDeployUrl(
            completedBuildUrl({
              liveUrl: null,
              projectId: projectId ? Number(projectId) : null,
              structuralOnly,
            }),
          );
          closed = true;
          thisStream.abort();
          return;
        }
        if (event === "error") {
          try {
            const data = JSON.parse(raw) as {
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
          closed = true;
          thisStream.abort();
        }
      };

      void consumeAuthedSse(
        `/api/build/${projectId}`,
        handleEvent,
        thisStream.signal,
      ).catch((err: unknown) => {
        if (closed || effectAc.signal.aborted || thisStream.signal.aborted) {
          return;
        }
        const msg = err instanceof Error ? err.message : "Build stream error";
        if (/credit/i.test(msg)) {
          setIsPaused(true);
          setError(msg);
          return;
        }
        if (/not authenticated/i.test(msg)) {
          // Normal access-token expiry is recoverable. The server owns the
          // HttpOnly refresh token and rotates it; keep reconnecting to the same
          // background build instead of telling the customer to sign in again.
          authReconnectAttempts += 1;
          setError(null);
          if (reconnectTimer) clearTimeout(reconnectTimer);
          const retryDelay = Math.min(
            15_000,
            1_000 * 2 ** Math.min(authReconnectAttempts - 1, 4),
          );
          reconnectTimer = setTimeout(() => {
            if (!closed && !effectAc.signal.aborted) connect();
          }, retryDelay);
          return;
        }
        setError(msg);
      });
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      effectAc.abort();
    };
  }, [projectId, pid]);

  const handleDeploy = async () => {
    if (!projectId) return;
    setDeploying(true);
    setError(null);
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

  const refreshApprovalState = async () => {
    await refetchProject();
  };

  const handleRevisePlan = async () => {
    if (!planRevision.trim()) return;
    setApprovalBusy(true);
    setError(null);
    try {
      await trpc.projects.revisePlan.mutate({
        projectId: pid,
        revision: planRevision.trim(),
      });
      await refreshApprovalState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan revision failed");
    } finally {
      setApprovalBusy(false);
    }
  };

  const handleApprovePlan = async () => {
    setApprovalBusy(true);
    setError(null);
    try {
      await trpc.projects.approvePlan.mutate({ projectId: pid });
      await refreshApprovalState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan approval failed");
    } finally {
      setApprovalBusy(false);
    }
  };

  const handleApproveMonetization = async () => {
    setApprovalBusy(true);
    setError(null);
    try {
      await trpc.projects.approveMonetization.mutate({ projectId: pid });
      await refreshApprovalState();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Monetization approval failed",
      );
    } finally {
      setApprovalBusy(false);
    }
  };

  const handleApproveIntegrations = async () => {
    setApprovalBusy(true);
    setError(null);
    try {
      await trpc.projects.approveIntegrations.mutate({ projectId: pid });
      await refreshApprovalState();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Integration approval failed",
      );
    } finally {
      setApprovalBusy(false);
    }
  };

  const handleResumeApprovedBuild = async () => {
    setApprovalBusy(true);
    setError(null);
    try {
      await trpc.projects.resumeApprovedBuild.mutate({ projectId: pid });
      setIsPaused(false);
      await refreshApprovalState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build resume failed");
    } finally {
      setApprovalBusy(false);
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

  const canUseWorkspace = isComplete || hasPartialFiles;

  const stack = stackPresentation(project?.techStack);
  const structuralOnly = structuralDone || stack?.structuralOnly === true;

  const destinationDisabled = (dest: DeployDestination): boolean => {
    if (structuralOnly) return true;
    if (stack && !stack.deployDestinations.includes(dest)) return true;
    if (dest === "preview") return false;
    const opt = deployOptions?.[dest];
    return opt ? !opt.configured : false;
  };

  const productContract = project?.productContract;
  const monetizationRequired =
    (productContract?.monetizationRequirements?.length ?? 0) > 0;
  const integrationsRequired = (productContract?.integrations?.length ?? 0) > 0;
  const unresolvedRequirements =
    project?.requirementManifest?.unresolvedMustHaveIds ?? [];
  const awaitingApproval =
    project?.status === "paused" &&
    project?.pauseReason === "approval_required";
  const approvalsReady =
    project?.planStatus === "approved" &&
    (!monetizationRequired || project?.monetizationApproved === true) &&
    (!integrationsRequired || project?.integrationsApproved === true);
  const unresolvedDecisions = [
    project?.planStatus !== "approved" ? "Plan approval" : null,
    monetizationRequired && project?.monetizationApproved !== true
      ? "Monetization approval"
      : null,
    integrationsRequired && project?.integrationsApproved !== true
      ? "Integration approval"
      : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">
          {project?.status === "production-certified"
            ? "Production certified"
            : project?.status === "validated"
              ? "Validated production candidate"
              : awaitingApproval
                ? "Review build plan"
                : "Building your app…"}
        </h1>
        {project && (
          <p className="text-slate-400 mb-4">
            {project.title} — {stack?.label ?? project.techStack}
            {stack?.structuralOnly && (
              <span
                data-testid="structural-stack-badge"
                className="ml-2 rounded bg-amber-900/60 px-2 py-0.5 text-xs font-medium text-amber-200"
              >
                {stack.badge}
              </span>
            )}
            {["running", "paused"].includes(project.status ?? "") && (
              <span className="ml-2 text-amber-400 text-sm">
                (runs in background — safe to refresh)
              </span>
            )}
          </p>
        )}

        {project && (
          <section
            className="mb-6 rounded-xl border border-slate-700 bg-slate-800/70 p-4"
            data-testid="build-status-panel"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <StatusFact
                label="Detected product"
                value={productContract?.productType ?? "Detecting"}
              />
              <StatusFact
                label="Selected stack"
                value={stack?.label ?? project.techStack ?? "Selecting"}
              />
              <StatusFact
                label="Build stage"
                value={buildStageLabel(project.buildStage)}
              />
              <StatusFact
                label="Output"
                value={outputMaturityLabel(project.outputMaturity)}
              />
              <StatusFact
                label="Research"
                value={
                  project.researchRecord
                    ? "Complete"
                    : project.buildStage === "researching"
                      ? "In progress"
                      : "Waiting"
                }
              />
              <StatusFact
                label="Plan"
                value={project.planStatus ?? "planning"}
              />
              <StatusFact
                label="Unresolved decisions"
                value={
                  unresolvedDecisions.length > 0
                    ? unresolvedDecisions.join(", ")
                    : "None"
                }
              />
              <StatusFact
                label="Incomplete requirements"
                value={
                  unresolvedRequirements.length > 0
                    ? unresolvedRequirements.join(", ")
                    : "None"
                }
              />
              <StatusFact
                label="Failure stage"
                value={project.failureStage ?? "None"}
              />
            </div>
          </section>
        )}

        {project && awaitingApproval && (
          <section
            className="mb-6 rounded-xl border border-amber-600/60 bg-amber-950/30 p-5 text-amber-100"
            data-testid="build-approval-panel"
          >
            <h2 className="text-lg font-semibold">Review before generation</h2>
            <p className="mt-1 text-sm text-amber-200/80">
              Generation is paused. Review the architecture and approve only the
              decisions you want AppForge to implement.
            </p>

            {project.productPlan && (
              <details className="mt-4 rounded-lg border border-amber-800/50 bg-slate-950/60 p-3">
                <summary className="cursor-pointer font-medium">
                  Review validated plan
                </summary>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <p className="font-medium text-white">
                    {project.productPlan.title}
                  </p>
                  <p>{project.productPlan.overview}</p>
                  <p>
                    <span className="text-slate-500">Architecture:</span>{" "}
                    {project.productPlan.architecture.summary}
                  </p>
                  <ol className="list-decimal space-y-1 pl-5">
                    {project.productPlan.implementationSequence.map(
                      (step: string) => (
                        <li key={step}>{step}</li>
                      ),
                    )}
                  </ol>
                </div>
              </details>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <ApprovalItem
                title="Plan"
                approved={project.planStatus === "approved"}
                detail="Approve the validated architecture, or request a revision first."
                onApprove={handleApprovePlan}
                disabled={approvalBusy}
              />
              {monetizationRequired && (
                <ApprovalItem
                  title="Monetization"
                  approved={project.monetizationApproved === true}
                  detail="Billing code is not generated until you explicitly approve it."
                  onApprove={handleApproveMonetization}
                  disabled={approvalBusy}
                />
              )}
              {integrationsRequired && (
                <ApprovalItem
                  title="External integrations"
                  approved={project.integrationsApproved === true}
                  detail="Integration credentials are not requested until you approve the integrations."
                  onApprove={handleApproveIntegrations}
                  disabled={approvalBusy}
                />
              )}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium">
                Revise the plan before generation
              </label>
              <textarea
                value={planRevision}
                onChange={(event) => setPlanRevision(event.target.value)}
                maxLength={4000}
                placeholder="Describe what you want changed in the plan."
                className="mt-2 min-h-24 w-full rounded-lg border border-amber-700/50 bg-slate-950 p-3 text-white"
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleRevisePlan}
                  disabled={approvalBusy || planRevision.trim().length < 3}
                  className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Request plan revision
                </button>
                <button
                  type="button"
                  onClick={handleResumeApprovedBuild}
                  disabled={
                    approvalBusy ||
                    (!approvalsReady &&
                      project.planStatus !== "revision_requested")
                  }
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {project.planStatus === "revision_requested"
                    ? "Regenerate revised plan"
                    : "Resume generation"}
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2">
          {(
            [
              "logs",
              "evidence",
              "preview",
              "code",
              "chat",
              "terminal",
            ] as BuildTab[]
          ).map((t) => (
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
          ))}
        </div>

        {tab === "logs" && (
          <div className="space-y-4 mb-8">
            {logs.map((log, idx) => (
              <AgentLogItem key={idx} log={log} />
            ))}
            {logs.length === 0 && !error && (
              <p className="text-slate-500 text-sm">
                Starting authenticated build stream…
              </p>
            )}
          </div>
        )}

        {tab === "evidence" && (
          <section
            className="mb-8 space-y-4 rounded-xl border border-slate-700 bg-slate-900/70 p-4"
            data-testid="project-evidence-panel"
          >
            <div>
              <h2 className="text-lg font-semibold text-white">
                Evidence & audit trail
              </h2>
              <p className="text-sm text-slate-400">
                Durable evidence from intake through validation, repair,
                deployment, and certification.
              </p>
            </div>
            {evidenceLoading && (
              <p className="text-sm text-slate-400">Loading evidence…</p>
            )}
            {evidenceError && (
              <p className="text-sm text-red-300">
                Evidence is temporarily unavailable.
              </p>
            )}
            {evidence && (
              <>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <StatusFact
                    label="Artifact version"
                    value={String(evidence.workingArtifact.version)}
                  />
                  <StatusFact
                    label="Snapshots"
                    value={String(evidence.snapshots.length)}
                  />
                  <StatusFact
                    label="Evidence events"
                    value={String(evidence.events.length)}
                  />
                  <StatusFact
                    label="Certification"
                    value={evidence.certification.status ?? "unknown"}
                  />
                  <StatusFact
                    label="Artifact hash"
                    value={
                      evidence.certification.currentArtifactSha256
                        ? evidence.certification.currentArtifactSha256.slice(
                            0,
                            16,
                          ) + "…"
                        : "Not available"
                    }
                  />
                  <StatusFact
                    label="Unresolved risks"
                    value={String(evidence.unresolvedRisks.length)}
                  />
                </div>

                <details className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                  <summary className="cursor-pointer font-medium text-white">
                    Canonical build evidence
                  </summary>
                  <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-slate-300">
                    {JSON.stringify(
                      {
                        originalPrompt: evidence.originalPrompt,
                        productContract: evidence.productContract,
                        selectedStack: evidence.selectedStack,
                        research: evidence.research,
                        architecture: evidence.architecture,
                        implementationTasks: evidence.implementationTasks,
                        requirementManifest: evidence.requirementManifest,
                        approvals: evidence.approvals,
                        certification: evidence.certification,
                        unresolvedRisks: evidence.unresolvedRisks,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>

                <details className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                  <summary className="cursor-pointer font-medium text-white">
                    Versioned generated files
                  </summary>
                  <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs text-slate-300">
                    {JSON.stringify(evidence.snapshots, null, 2)}
                  </pre>
                </details>

                <div className="space-y-2">
                  {evidence.events
                    .slice()
                    .reverse()
                    .map((event) => (
                      <details
                        key={event.id}
                        className="rounded-lg border border-slate-700 bg-slate-950/50 p-3"
                      >
                        <summary className="cursor-pointer text-sm font-medium text-white">
                          #{event.id} · {event.kind} ·{" "}
                          {event.buildStage ?? "unknown stage"}
                          {event.artifactVersion !== null
                            ? " · artifact v" + event.artifactVersion
                            : ""}
                        </summary>
                        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs text-slate-300">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </details>
                    ))}
                </div>
              </>
            )}
          </section>
        )}

        {tab === "preview" && pid > 0 && (
          <BuildLivePreview
            projectId={pid}
            deployUrl={deployUrl}
            enabled={canUseWorkspace}
          />
        )}

        {tab === "code" && pid > 0 && (
          <ProjectCodeEditor projectId={pid} enabled={canUseWorkspace} />
        )}

        {tab === "chat" && pid > 0 && <ProjectChat projectId={pid} />}

        {tab === "terminal" && pid > 0 && (
          <AgentTerminal projectId={pid} enabled={canUseWorkspace} />
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

        {isComplete && !error && !isPaused && !awaitingApproval && (
          <div className="mt-8 bg-green-900/30 border border-green-800 rounded-lg p-4 text-green-300">
            <p className="font-semibold text-lg">
              {structuralOnly
                ? "Source generation complete (not deployed)"
                : project?.status === "production-certified"
                  ? "Production certification complete!"
                  : "Validated production candidate"}
            </p>
            <p className="mt-2">
              {structuralOnly
                ? (stack?.notice ??
                  "This stack is structural-only: download or export the source; it has not been deployed.")
                : project?.status === "production-certified"
                  ? "The deployed product passed the configured production verification gates."
                  : "The artifact is validated but is not production-certified. You can edit, export, preview, or deploy it."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!structuralOnly && (
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
                  </select>
                </label>
              )}
              {structuralOnly ? null : deployUrl ? (
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
              deployUrl={structuralOnly ? null : deployUrl}
              deployGuide={deployGuide}
              techStack={stack?.label ?? project?.techStack}
              structuralNotice={structuralOnly ? (stack?.notice ?? null) : null}
            />
            <RevenueReadinessPanel projectId={pid} enabled={canUseWorkspace} />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-slate-100">{value}</p>
    </div>
  );
}

function ApprovalItem({
  title,
  approved,
  detail,
  onApprove,
  disabled,
}: {
  title: string;
  approved: boolean;
  detail: string;
  onApprove: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-lg border border-amber-800/60 bg-slate-900/70 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{title}</p>
        <span className={approved ? "text-green-300" : "text-amber-300"}>
          {approved ? "Approved" : "Approval required"}
        </span>
      </div>
      <p className="mt-2 text-xs text-slate-400">{detail}</p>
      {!approved && (
        <button
          type="button"
          onClick={onApprove}
          disabled={disabled}
          className="mt-3 rounded bg-amber-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          Approve
        </button>
      )}
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

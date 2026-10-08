import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

export function Admin() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<
    "analytics" | "operations" | "evidence" | "codes" | "moderation"
  >("analytics");
  const [grantType, setGrantType] = useState<"lifetime" | "limited">("limited");
  const [credits, setCredits] = useState("100");
  const [minted, setMinted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [evidenceProjectId, setEvidenceProjectId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [challengeSent, setChallengeSent] = useState(false);

  const {
    data: mfaStatus,
    isError: mfaStatusError,
    isLoading: mfaStatusLoading,
    refetch: refetchMfaStatus,
  } = useQuery({
    queryKey: ["admin", "mfaStatus"],
    queryFn: () => trpc.admin.mfaStatus.query(),
    retry: false,
  });

  const requestMfa = useMutation({
    mutationFn: () => trpc.admin.requestMfa.mutate(),
    onSuccess: () => {
      setChallengeSent(true);
      setMfaCode("");
    },
  });

  const verifyMfa = useMutation({
    mutationFn: () => trpc.admin.verifyMfa.mutate({ code: mfaCode.trim() }),
    onSuccess: async () => {
      setMfaCode("");
      await refetchMfaStatus();
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
  });

  const {
    data: me,
    isError: meError,
    isLoading: meLoading,
  } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: () => trpc.admin.me.query(),
    retry: false,
    enabled: mfaStatus?.verified === true,
  });

  const { data: analytics } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => trpc.admin.analytics.query(),
    enabled: !!me,
  });

  const {
    data: operations,
    isError: operationsError,
    isLoading: operationsLoading,
  } = useQuery({
    queryKey: ["admin", "operations"],
    queryFn: () => trpc.admin.operations.query(),
    enabled: !!me && tab === "operations",
    refetchInterval: 15_000,
  });

  const parsedEvidenceProjectId = Number.parseInt(evidenceProjectId, 10);
  const {
    data: projectEvidence,
    isLoading: evidenceLoading,
    isError: evidenceError,
  } = useQuery({
    queryKey: ["admin", "projectEvidence", parsedEvidenceProjectId],
    queryFn: () =>
      trpc.admin.projectEvidence.query({ projectId: parsedEvidenceProjectId }),
    enabled:
      !!me &&
      tab === "evidence" &&
      Number.isInteger(parsedEvidenceProjectId) &&
      parsedEvidenceProjectId > 0,
  });

  const { data: codes } = useQuery({
    queryKey: ["admin", "listCodes"],
    queryFn: () => trpc.admin.listCodes.query(),
    enabled: !!me && tab === "codes",
  });

  const { data: moderationQueue, refetch: refetchModeration } = useQuery({
    queryKey: ["admin", "moderationQueue"],
    queryFn: () => trpc.admin.moderationQueue.query(),
    enabled: !!me && tab === "moderation",
  });

  const reviewModeration = useMutation({
    mutationFn: (payload: {
      flagId: number;
      action: "dismiss" | "uphold" | "ban";
    }) => trpc.admin.reviewModeration.mutate(payload),
    onSuccess: () => void refetchModeration(),
  });

  const createCode = useMutation({
    mutationFn: () =>
      trpc.admin.createCode.mutate({
        grantType,
        credits:
          grantType === "limited"
            ? Math.max(1, parseInt(credits, 10) || 0)
            : undefined,
      }),
    onSuccess: (data) => {
      setMinted(data.code);
      setCopied(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "listCodes"] });
    },
  });

  if (mfaStatusError || meError) {
    return (
      <div className="min-h-screen p-8 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>This dashboard requires the authenticated owner account.</p>
      </div>
    );
  }

  if (mfaStatusLoading) {
    return <div className="min-h-screen p-8">Checking admin security…</div>;
  }

  if (!mfaStatus?.verified) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-8">
        <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800">
          <h1 className="text-2xl font-bold mb-2">
            Admin verification required
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            A one-time SMS code must be verified before any admin data or
            controls are available.
          </p>

          <button
            type="button"
            onClick={() => requestMfa.mutate()}
            disabled={requestMfa.isPending}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {requestMfa.isPending
              ? "Sending…"
              : challengeSent
                ? `Send another code to ${
                    mfaStatus?.phoneHint || "your registered phone"
                  }`
                : `Send SMS code to ${
                    mfaStatus?.phoneHint || "your registered phone"
                  }`}
          </button>

          {requestMfa.isError && (
            <p className="mt-3 text-sm text-red-600">
              Unable to send the admin verification code.
            </p>
          )}

          <label className="mt-5 block text-sm font-semibold">
            Six-digit code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={mfaCode}
              onChange={(event) =>
                setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 tracking-[0.35em] dark:border-slate-600 dark:bg-slate-700"
              aria-label="Admin SMS code"
            />
          </label>

          <button
            type="button"
            onClick={() => verifyMfa.mutate()}
            disabled={mfaCode.length !== 6 || verifyMfa.isPending}
            className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {verifyMfa.isPending ? "Verifying…" : "Verify and enter admin"}
          </button>

          {verifyMfa.isError && (
            <p className="mt-3 text-sm text-red-600">
              That code was not accepted. Admin access remains locked.
            </p>
          )}

          <p className="mt-5 text-xs text-slate-500">
            If you receive an AppForge admin code you did not request, treat it
            as a security warning and secure your account.
          </p>
        </div>
      </div>
    );
  }

  if (meLoading || !me) {
    return <div className="min-h-screen p-8">Loading secure admin…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-8">
      <h1 className="text-3xl font-bold mb-2">AppForge Admin</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8">
        Signed in as {me.email}
      </p>

      <div className="flex gap-2 mb-8">
        {(
          [
            "analytics",
            "operations",
            "evidence",
            "codes",
            "moderation",
          ] as const
        ).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={`px-4 py-2 rounded-lg font-semibold ${
              tab === item
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300"
            }`}
          >
            {item === "analytics"
              ? "Analytics"
              : item === "operations"
                ? "Operations"
                : item === "evidence"
                  ? "Evidence"
                  : item === "codes"
                    ? "God codes"
                    : "Moderation"}
          </button>
        ))}
      </div>

      {tab === "analytics" && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Users", value: analytics.counts.totalUsers },
              {
                label: "Signups (7d)",
                value: analytics.counts.recentSignups7d,
              },
              {
                label: "Builds started",
                value: analytics.counts.buildsStarted,
              },
              { label: "Builds (30d)", value: analytics.counts.builds30d },
              {
                label: "Active subs",
                value: analytics.counts.activeSubscriptions,
              },
              {
                label: "Credits held",
                value: analytics.counts.creditBalanceSum,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"
              >
                <div className="text-sm text-slate-500">{card.label}</div>
                <div className="text-2xl font-bold">{card.value}</div>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-semibold">Subscriptions</h2>
          <table className="w-full bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
            <thead className="bg-slate-100 dark:bg-slate-700">
              <tr>
                <th className="text-left p-3">Tier</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Count</th>
              </tr>
            </thead>
            <tbody>
              {analytics.subscriptionsByTier.map((row) => (
                <tr
                  key={`${row.tier}-${row.status}`}
                  className="border-t border-slate-200 dark:border-slate-700"
                >
                  <td className="p-3 capitalize">{row.tier}</td>
                  <td className="p-3">{row.status}</td>
                  <td className="p-3">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="text-xl font-semibold">Recent signups</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
              <thead className="bg-slate-100 dark:bg-slate-700">
                <tr>
                  <th className="text-left p-3">ID</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Credits</th>
                  <th className="text-left p-3">Tier</th>
                  <th className="text-left p-3">Sub</th>
                  <th className="text-left p-3">Builds</th>
                  <th className="text-left p-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {analytics.recentUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="p-3">{u.id}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">
                      {u.unlimited ? "Unlimited" : u.credits}
                    </td>
                    <td className="p-3 capitalize">{u.tier}</td>
                    <td className="p-3">
                      {u.subscriptionStatus
                        ? `${u.subscriptionTier} (${u.subscriptionStatus})`
                        : "—"}
                    </td>
                    <td className="p-3">{u.buildsStarted}</td>
                    <td className="p-3">
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "operations" && operationsError && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          Operations diagnostics are temporarily unavailable.
        </div>
      )}

      {tab === "operations" && operationsLoading && !operations && (
        <p className="text-slate-500">Loading operations diagnostics…</p>
      )}

      {tab === "operations" && operations && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Database",
                value: operations.database.connected
                  ? `${operations.database.latencyMs} ms`
                  : "Disconnected",
              },
              {
                label: "Queue",
                value: `${operations.queue.backend} · ${operations.queue.depth} waiting`,
              },
              {
                label: "Redis",
                value: operations.redis.connected
                  ? "Connected"
                  : "Disconnected",
              },
              {
                label: "Credits spent",
                value: operations.cost.creditsSpent,
              },
              {
                label: "Model metrics",
                value: operations.modelUsage.length,
              },
              {
                label: "Pending moderation",
                value: operations.abuse.pendingModeration,
              },
              {
                label: "Integrations",
                value: `${operations.integrations.configured}/${operations.integrations.integrations.length}`,
              },
              {
                label: "Recent traces",
                value: operations.recentTraces.length,
              },
            ].map((card) => (
              <div
                key={card.label}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"
              >
                <div className="text-sm text-slate-500">{card.label}</div>
                <div className="text-xl font-bold">{card.value}</div>
              </div>
            ))}
          </div>

          {operations.alerts.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-xl font-semibold mb-3">
                Active operational alerts
              </h2>
              <div className="space-y-2">
                {operations.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-lg border border-amber-300 dark:border-amber-800 p-3"
                  >
                    <span className="font-semibold uppercase text-xs">
                      {alert.severity}
                    </span>
                    <p className="text-sm mt-1">{alert.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-xl font-semibold mb-3">
              Recent operational traces
            </h2>
            <div className="space-y-2 text-sm">
              {operations.recentTraces.slice(0, 20).map((trace) => (
                <div
                  key={trace.id}
                  className="flex flex-wrap gap-x-3 border-b border-slate-200 dark:border-slate-700 pb-2"
                >
                  <span className="font-semibold">{trace.component}</span>
                  <span>{trace.operation}</span>
                  <span className="capitalize">{trace.status}</span>
                  <span>{trace.durationMs ?? 0} ms</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "evidence" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-xl font-semibold mb-2">
              Project evidence & audit trail
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Owner-only view of the durable evidence preserved for a project.
            </p>
            <label className="block max-w-sm text-sm font-semibold">
              Project ID
              <input
                type="number"
                min={1}
                value={evidenceProjectId}
                onChange={(event) => setEvidenceProjectId(event.target.value)}
                className="mt-1 w-full rounded-sm border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-700"
                placeholder="Enter project ID"
              />
            </label>
          </div>

          {evidenceLoading && (
            <p className="text-slate-500">Loading project evidence…</p>
          )}
          {evidenceError && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              Project evidence could not be loaded.
            </div>
          )}
          {projectEvidence && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Project",
                    value: projectEvidence.projectId,
                  },
                  {
                    label: "Snapshots",
                    value: projectEvidence.snapshots.length,
                  },
                  {
                    label: "Evidence events",
                    value: projectEvidence.events.length,
                  },
                  {
                    label: "Certification",
                    value: projectEvidence.certification.status ?? "unknown",
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm"
                  >
                    <div className="text-sm text-slate-500">{card.label}</div>
                    <div className="text-xl font-bold break-all">
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>

              <details className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm">
                <summary className="cursor-pointer font-semibold">
                  Full canonical evidence
                </summary>
                <pre className="mt-4 max-h-128 overflow-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(projectEvidence, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      )}

      {tab === "codes" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm max-w-xl">
            <h2 className="text-xl font-semibold mb-4">Create god code</h2>
            <p className="text-sm text-slate-500 mb-4">
              The plaintext code is shown once. Copy it now — it cannot be
              listed again.
            </p>
            <div className="flex flex-col gap-3 mb-4">
              <label className="text-sm font-semibold">
                Grant
                <select
                  value={grantType}
                  onChange={(e) =>
                    setGrantType(e.target.value as "lifetime" | "limited")
                  }
                  className="mt-1 w-full p-2 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                >
                  <option value="limited">Limited credits</option>
                  <option value="lifetime">Lifetime (unlimited credits)</option>
                </select>
              </label>
              {grantType === "limited" && (
                <label className="text-sm font-semibold">
                  Credits
                  <input
                    type="number"
                    min={1}
                    value={credits}
                    onChange={(e) => setCredits(e.target.value)}
                    className="mt-1 w-full p-2 rounded-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
                  />
                </label>
              )}
              <button
                type="button"
                onClick={() => createCode.mutate()}
                disabled={createCode.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold"
              >
                {createCode.isPending ? "Creating…" : "Mint code"}
              </button>
              {createCode.isError && (
                <p className="text-sm text-amber-700">
                  {String((createCode.error as Error)?.message || "")}
                </p>
              )}
            </div>
            {minted && (
              <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm font-semibold mb-2">
                  Copy now — this is the only time it is shown.
                </p>
                <code className="block text-lg font-mono break-all mb-3">
                  {minted}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(minted);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                  className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            )}
          </div>

          <h2 className="text-xl font-semibold">Codes</h2>
          {codes && codes.length > 0 ? (
            <table className="w-full bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
              <thead className="bg-slate-100 dark:bg-slate-700">
                <tr>
                  <th className="text-left p-3">ID</th>
                  <th className="text-left p-3">Grant</th>
                  <th className="text-left p-3">Credits</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Redeemed by</th>
                  <th className="text-left p-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="p-3">{c.id}</td>
                    <td className="p-3 capitalize">{c.grantType}</td>
                    <td className="p-3">
                      {c.grantType === "lifetime" ? "Unlimited" : c.credits}
                    </td>
                    <td className="p-3 capitalize">{c.status}</td>
                    <td className="p-3">{c.redeemedByUserId ?? "—"}</td>
                    <td className="p-3">
                      {c.createdAt
                        ? new Date(c.createdAt).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-slate-500">No codes yet.</p>
          )}
        </div>
      )}

      {tab === "moderation" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Moderation queue</h2>
          {!moderationQueue?.length ? (
            <p className="text-slate-500">No pending flags.</p>
          ) : (
            <table className="w-full bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden">
              <thead className="bg-slate-100 dark:bg-slate-700">
                <tr>
                  <th className="text-left p-3">ID</th>
                  <th className="text-left p-3">User</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-left p-3">Excerpt</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {moderationQueue.map((flag) => (
                  <tr
                    key={flag.id}
                    className="border-t border-slate-200 dark:border-slate-700"
                  >
                    <td className="p-3">{flag.id}</td>
                    <td className="p-3">{flag.userId}</td>
                    <td className="p-3">{flag.category}</td>
                    <td className="p-3 text-sm max-w-xs truncate">
                      {flag.flaggedText}
                    </td>
                    <td className="p-3 space-x-2">
                      <button
                        type="button"
                        onClick={() =>
                          reviewModeration.mutate({
                            flagId: flag.id,
                            action: "dismiss",
                          })
                        }
                        className="text-xs bg-slate-200 dark:bg-slate-600 px-2 py-1 rounded-sm"
                      >
                        Dismiss
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          reviewModeration.mutate({
                            flagId: flag.id,
                            action: "uphold",
                          })
                        }
                        className="text-xs bg-amber-200 dark:bg-amber-800 px-2 py-1 rounded-sm"
                      >
                        Uphold
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          reviewModeration.mutate({
                            flagId: flag.id,
                            action: "ban",
                          })
                        }
                        className="text-xs bg-red-600 text-white px-2 py-1 rounded-sm"
                      >
                        Ban
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

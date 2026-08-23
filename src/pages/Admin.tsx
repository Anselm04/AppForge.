import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { useNavigate } from "react-router-dom";

export function Admin() {
  const navigate = useNavigate();
  const [otp, setOtp] = useState("");
  const [rawCode, setRawCode] = useState("");
  const [activeTab, setActiveTab] = useState("analytics");
  const [selectedTier, setSelectedTier] = useState("starter");

  // Owner check
  const { data: me, isError } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: () => trpc.admin.me.query(),
  });

  const { data: analytics } = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: () => trpc.admin.analytics.query(),
    enabled: !!me,
  });

  const { data: godCodes } = useQuery({
    queryKey: ["admin", "godCodes"],
    queryFn: () => trpc.admin.listGodCodes.query(),
    enabled: !!me,
  });

  const { data: moderationQueue } = useQuery({
    queryKey: ["admin", "moderation"],
    queryFn: () => trpc.admin.moderationQueue.query(),
    enabled: !!me && activeTab === "moderation",
  });

  const { data: compliance } = useQuery({
    queryKey: ["admin", "compliance"],
    queryFn: () => trpc.admin.complianceExport.query(),
    enabled: !!me && activeTab === "compliance",
  });

  const createCode = useMutation({
    mutationFn: () => trpc.admin.createGodCodeInit.mutate({ tier: selectedTier, credits: 0, trialDays: 0 }),
    onSuccess: (data) => {
      setRawCode(data.rawCode);
      alert(data.message);
    },
  });

  const verifyCode = useMutation({
    mutationFn: () => trpc.admin.verifyGodCode.mutate({ rawCode, otp }),
    onSuccess: (data) => {
      alert(data.message);
      setRawCode("");
      setOtp("");
    },
  });

  const banUser = useMutation({
    mutationFn: ({ userId, reason }: { userId: number; reason: string }) => trpc.admin.banUser.mutate({ userId, reason }),
  });

  const reviewFlag = useMutation({
    mutationFn: ({ flagId, action }: { flagId: number; action: string }) =>
      trpc.admin.reviewFlag.mutate({ flagId, action: action as "warn" | "strike" | "ban" | "dismiss" }),
  });

  if (isError) {
    return (
      <div className="min-h-screen p-8 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p>This dashboard is owner-only.</p>
      </div>
    );
  }

  if (!me) return <div className="min-h-screen p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-8">
      <h1 className="text-3xl font-bold mb-6">AppForge Admin</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-8">Logged in as {me.email}</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {["analytics", "godcodes", "users", "moderation", "compliance"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg font-semibold ${
              activeTab === tab
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Analytics ── */}
      {activeTab === "analytics" && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Total Users", value: analytics.counts.totalUsers },
              { label: "Active (30d)", value: analytics.counts.activeUsers30d },
              { label: "Total Projects", value: analytics.counts.totalProjects },
              { label: "Builds (30d)", value: analytics.counts.builds30d },
              { label: "Revenue", value: `$${analytics.counts.totalRevenue}` },
            ].map((c) => (
              <div key={c.label} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow">
                <div className="text-sm text-slate-500">{c.label}</div>
                <div className="text-2xl font-bold">{c.value}</div>
              </div>
            ))}
          </div>

          <h2 className="text-xl font-semibold mt-6">Subscriptions by Tier</h2>
          <table className="w-full bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
            <thead className="bg-slate-100 dark:bg-slate-700">
              <tr>
                <th className="text-left p-3">Tier</th>
                <th className="text-left p-3">Count</th>
              </tr>
            </thead>
            <tbody>
              {analytics.subscriptionsByTier.map((s) => (
                <tr key={s.tier} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="p-3 capitalize">{s.tier}</td>
                  <td className="p-3">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="text-xl font-semibold mt-6">Recent Users</h2>
          <table className="w-full bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
            <thead className="bg-slate-100 dark:bg-slate-700">
              <tr>
                <th className="text-left p-3">ID</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Name</th>
                <th className="text-left p-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentUsers.map((u) => (
                <tr key={u.id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="p-3">{u.id}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.name}</td>
                  <td className="p-3">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {analytics.bannedUsers.length > 0 && (
            <>
              <h2 className="text-xl font-semibold mt-6 text-red-600">Banned Users</h2>
              <table className="w-full bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
                <thead className="bg-slate-100 dark:bg-slate-700">
                  <tr>
                    <th className="text-left p-3">ID</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Reason</th>
                    <th className="text-left p-3">Banned At</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.bannedUsers.map((u) => (
                    <tr key={u.id} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="p-3">{u.id}</td>
                      <td className="p-3">{u.email}</td>
                      <td className="p-3">{u.banReason}</td>
                      <td className="p-3">{u.bannedAt ? new Date(u.bannedAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {/* ── God Codes ── */}
      {activeTab === "godcodes" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow">
            <h2 className="text-xl font-semibold mb-4">Create God Code</h2>
            <div className="flex gap-4 mb-4">
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="p-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                {["starter", "builder", "studio", "enterprise", "custom", "admin"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                onClick={() => createCode.mutate()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                disabled={createCode.isPending}
              >
                Generate & Send OTP
              </button>
            </div>
            {rawCode && (
              <div className="mt-4">
                <p className="text-sm text-slate-500 mb-1">Raw code (save this somewhere safe):</p>
                <code className="bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded text-lg font-mono">{rawCode}</code>
                <div className="mt-3">
                  <input
                    placeholder="Enter 6-digit OTP from SMS"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    className="p-2 rounded border border-slate-300 dark:border-slate-600 mr-2"
                  />
                  <button
                    onClick={() => verifyCode.mutate()}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                    disabled={verifyCode.isPending || otp.length !== 6}
                  >
                    Verify & Activate
                  </button>
                </div>
              </div>
            )}
          </div>

          <h2 className="text-xl font-semibold">Active Codes</h2>
          {godCodes && godCodes.length > 0 ? (
            <table className="w-full bg-white dark:bg-slate-800 rounded-xl shadow overflow-hidden">
              <thead className="bg-slate-100 dark:bg-slate-700">
                <tr>
                  <th className="text-left p-3">ID</th>
                  <th className="text-left p-3">Tier</th>
                  <th className="text-left p-3">Used</th>
                  <th className="text-left p-3">Used By</th>
                  <th className="text-left p-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {godCodes.map((c) => (
                  <tr key={c.id} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="p-3">{c.id}</td>
                    <td className="p-3 capitalize">{c.tier}</td>
                    <td className="p-3">{c.isUsed ? "Yes" : "No"}</td>
                    <td className="p-3">{c.usedByUserId ?? "—"}</td>
                    <td className="p-3">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-slate-500">No god codes yet.</p>
          )}
        </div>
      )}

      {/* ── Moderation ── */}
      {activeTab === "moderation" && moderationQueue && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Flagged Content Queue ({moderationQueue.length})</h2>
          {moderationQueue.length === 0 ? (
            <p className="text-slate-500">No pending flags.</p>
          ) : (
            <div className="space-y-4">
              {moderationQueue.map((flag) => (
                <div key={flag.id} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow">
                  <div className="flex justify-between">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      flag.category === "sexual" ? "bg-red-100 text-red-800" :
                      flag.category === "dangerous" ? "bg-orange-100 text-orange-800" :
                      flag.category === "illegal" ? "bg-red-100 text-red-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {flag.category}
                    </span>
                    <span className="text-xs text-slate-500">{new Date(flag.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{flag.flaggedText}</p>
                  <div className="mt-3 flex gap-2">
                    {["warn", "strike", "ban", "dismiss"].map((action) => (
                      <button
                        key={action}
                        onClick={() => reviewFlag.mutate({ flagId: flag.id, action })}
                        className={`px-3 py-1 rounded text-sm font-semibold ${
                          action === "ban" ? "bg-red-600 text-white hover:bg-red-700" :
                          action === "dismiss" ? "bg-slate-300 text-slate-700 hover:bg-slate-400" :
                          "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        }`}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Compliance ── */}
      {activeTab === "compliance" && compliance && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Vanta-Style Compliance Export</h2>
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow">
            <p className="text-sm text-slate-500 mb-2">Export Date: {new Date(compliance.exportDate).toLocaleString()}</p>
            <p className="text-sm text-slate-500 mb-4">Generated By: {compliance.generatedBy}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Records", value: compliance.summary.totalRecords },
                { label: "Total Users", value: compliance.summary.users[0]?.count ?? 0 },
                { label: "Banned Users", value: compliance.summary.banned[0]?.count ?? 0 },
                { label: "Active Subs", value: compliance.summary.activeSubs[0]?.count ?? 0 },
              ].map((s) => (
                <div key={s.label} className="bg-slate-100 dark:bg-slate-700 rounded p-3">
                  <div className="text-xs text-slate-500">{s.label}</div>
                  <div className="text-xl font-bold">{s.value}</div>
                </div>
              ))}
            </div>

            <pre className="bg-slate-100 dark:bg-slate-900 p-4 rounded text-xs overflow-auto max-h-96">
              {JSON.stringify(compliance, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
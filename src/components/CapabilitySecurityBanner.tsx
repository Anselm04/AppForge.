import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function CapabilitySecurityBanner() {
  const { data: mfaStatus } = useQuery({
    queryKey: ["admin", "mfaStatus", "capability-security"],
    queryFn: () => trpc.admin.mfaStatus.query(),
    retry: false,
  });

  const { data } = useQuery({
    queryKey: ["admin", "security", "capability-incidents"],
    queryFn: () => trpc.capabilitySecurity.incidents.query(),
    enabled: mfaStatus?.verified === true,
    retry: false,
    refetchInterval: 15_000,
  });

  if (!mfaStatus?.verified || !data) return null;
  if (data.providerState.state === "healthy" && data.incidents.length === 0) {
    return null;
  }

  const active = data.incidents.slice(0, 10);
  const critical =
    data.providerState.state === "disabled" ||
    active.some((incident) => asRecord(incident.details).severity === "critical");

  return (
    <section
      aria-label="Capability security incidents"
      className={`mx-8 mt-6 rounded-xl border p-4 ${
        critical
          ? "border-red-500 bg-red-50 text-red-950 dark:bg-red-950/40 dark:text-red-100"
          : "border-amber-400 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Capability security incidents</h2>
        <span className="text-xs font-semibold uppercase">
          Composio: {data.providerState.state}
        </span>
      </div>
      <p className="mt-1 text-sm">{data.providerState.reason}</p>
      {active.length > 0 && (
        <div className="mt-3 space-y-2">
          {active.map((incident) => {
            const details = asRecord(incident.details);
            return (
              <div key={incident.id} className="rounded-lg border border-current/20 p-3 text-sm">
                <div className="flex flex-wrap gap-x-3 gap-y-1 font-semibold">
                  <span>{String(details.severity ?? "warning").toUpperCase()}</span>
                  <span>{String(details.containmentAction ?? "blocked")}</span>
                  <span>{String(details.provider ?? "composio")}</span>
                </div>
                <p className="mt-1">{String(details.reason ?? "Capability operation contained")}</p>
                <p className="mt-1 text-xs opacity-80">
                  Project {String(details.projectId ?? "—")} · Build {String(details.buildJobId ?? "—")} · Correlation {String(details.correlationId ?? "—")}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

import { initTRPC } from "@trpc/server";
import { publicProcedure, protectedProcedure } from "./trpc.js";
import {
  evaluateOperationalAlerts,
  operationalSnapshot,
} from "../lib/operationsObservability.js";
import { getStartupReadiness } from "../services/startupState.js";

const t = initTRPC.create();

export const systemRouter = t.router({
  health: publicProcedure.query(() => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  })),

  diagnostics: protectedProcedure.query(() => {
    const snapshot = operationalSnapshot();
    const startup = getStartupReadiness();
    const alerts = evaluateOperationalAlerts();
    const connectivityDegraded = alerts.some(
      (alert) =>
        alert.severity === "critical" &&
        (alert.id === "database_unavailable" ||
          alert.id === "redis_unavailable"),
    );
    return {
      generatedAt: snapshot.generatedAt,
      status: startup.ready && !connectivityDegraded ? "ok" : "degraded",
      startup: startup.phase,
      uptimeSeconds: snapshot.uptimeSeconds,
      process: snapshot.process,
      capacity: snapshot.capacity,
      alerts: alerts.map((alert) => ({
        severity: alert.severity,
        message: alert.message,
      })),
      metrics: snapshot.counters.map((metric) => ({
        name: metric.name,
        value: metric.value,
      })),
    };
  }),
});

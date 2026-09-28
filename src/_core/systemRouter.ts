import { initTRPC } from "@trpc/server";
import { publicProcedure, protectedProcedure } from "./trpc.js";
import { operationalSnapshot } from "../lib/operationsObservability.js";
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
    return {
      generatedAt: snapshot.generatedAt,
      status: startup.ready ? "ok" : "degraded",
      startup: startup.phase,
      uptimeSeconds: snapshot.uptimeSeconds,
      process: snapshot.process,
      capacity: snapshot.capacity,
      metrics: snapshot.counters.map((metric) => ({
        name: metric.name,
        value: metric.value,
      })),
    };
  }),
});

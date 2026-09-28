import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateOperationalAlerts,
  incrementOperationalMetric,
  operationalSnapshot,
  recordModelUsage,
  recordPipelineTraceEvent,
  recordRateLimitRejection,
  renderPrometheusMetrics,
  resetOperationalObservabilityForTests,
  setOperationalGauge,
  startOperationalTrace,
} from "../lib/operationsObservability.js";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("#23 Operations and Observability", () => {
  beforeEach(() => {
    resetOperationalObservabilityForTests();
  });

  it("records bounded operational traces and pipeline-agent events", () => {
    const trace = startOperationalTrace({
      component: "build",
      operation: "test_build",
      metadata: { projectId: 42 },
    });
    recordPipelineTraceEvent("Planner", "start", 42);
    recordPipelineTraceEvent("Coder", "complete", 42);
    recordPipelineTraceEvent("Validator", "complete", 42);
    recordPipelineTraceEvent("Research", "complete", 42);
    trace.end("ok");

    const snapshot = operationalSnapshot();
    expect(snapshot.recentTraces[0]).toMatchObject({
      component: "build",
      operation: "test_build",
      status: "ok",
    });
    expect(
      snapshot.counters.some(
        (metric) =>
          metric.name === "appforge_agent_events_total" &&
          metric.labels.agent === "Planner",
      ),
    ).toBe(true);
  });

  it("monitors model usage, rate-limit abuse signals and Prometheus output", () => {
    recordModelUsage({
      provider: "test-provider",
      model: "test-model",
      promptTokens: 100,
      completionTokens: 40,
      totalTokens: 140,
      durationMs: 250,
      ok: true,
    });
    recordRateLimitRejection("global");
    incrementOperationalMetric("appforge_builds_total", { status: "completed" });
    setOperationalGauge("appforge_database_connected", 1);

    const metrics = renderPrometheusMetrics();
    expect(metrics).toContain(
      'appforge_model_tokens_total{model="test-model",provider="test-provider"} 140',
    );
    expect(metrics).toContain(
      'appforge_rate_limit_rejections_total{tier="global"} 1',
    );
    expect(metrics).toContain("appforge_database_connected 1");
  });

  it("evaluates capacity, database, Redis and abuse alerts", () => {
    setOperationalGauge("appforge_queue_depth", 101, { backend: "memory" });
    setOperationalGauge("appforge_database_connected", 0);
    for (let i = 0; i < 101; i += 1) {
      recordRateLimitRejection("global");
    }

    const alerts = evaluateOperationalAlerts();
    expect(alerts.some((alert) => alert.id === "queue_backlog")).toBe(true);
    expect(alerts.some((alert) => alert.id === "database_unavailable")).toBe(
      true,
    );
    expect(alerts.some((alert) => alert.id === "rate_limit_pressure")).toBe(
      true,
    );
  });

  it("wires structured logs, Sentry, HTTP metrics and health/readiness/liveness", () => {
    const logger = source("src/_core/logger.ts");
    const server = source("src/server.ts");
    const health = source("src/routes/health.ts");

    expect(logger).toContain("Structured application logger");
    expect(logger).toContain("serialize(obj");
    expect(logger).toContain("[REDACTED]");
    expect(server).toContain("Sentry.init({");
    expect(server).toContain('app.get("/metrics"');
    expect(server).toContain("appforge_http_requests_total");
    expect(health).toContain('router.get("/live"');
    expect(health).toContain('router.get("/ready"');
    expect(health).toContain("appforge_database_connected");
    expect(health).toContain("appforge_redis_connected");
  });

  it("traces builds, deployment and planner/coder/validator/research execution", () => {
    const worker = source("src/services/build-worker.ts");
    const part0 = source("src/agents/.pipeline_parts/part0.txt");
    const part1 = source("src/agents/.pipeline_parts/part1.txt");
    const llm = source("src/_core/llm.ts");

    expect(worker).toContain('component: "build"');
    expect(worker).toContain('component: "deployment"');
    expect(worker).toContain("appforge_builds_total");
    expect(worker).toContain("appforge_deployments_total");
    expect(part0).toContain("recordPipelineTraceEvent");
    expect(part1).toContain("recordPipelineTraceEvent(agent, type, projectId)");
    expect(llm).toContain("recordModelUsage({");
  });

  it("monitors queue, Redis, database, costs, billing and integrations for the owner", () => {
    const queue = source("src/services/build-queue.ts");
    const admin = source("src/routers/admin.ts");

    expect(queue).toContain("getBuildQueueDiagnostics");
    expect(queue).toContain("appforge_queue_depth");
    expect(queue).toContain("appforge_redis_connected");
    expect(admin).toContain("operations: ownerOnlyProcedure.query");
    expect(admin).toContain("creditsSpent");
    expect(admin).toContain("billing:");
    expect(admin).toContain("summarizeTeamIntegrations()");
    expect(admin).toContain("pendingModeration");
    expect(admin).toContain("evaluateOperationalAlerts()");
  });

  it("provides authenticated user diagnostics and owner-only operational dashboards", () => {
    const system = source("src/_core/systemRouter.ts");
    const account = source("src/pages/Account.tsx");
    const adminPage = source("src/pages/Admin.tsx");
    const alerts = source("monitoring/alerts.yml");
    const dashboard = JSON.parse(
      source("monitoring/grafana/dashboards/appforge-operations.json"),
    );

    expect(system).toContain("diagnostics: protectedProcedure.query");
    expect(account).toContain("System diagnostics");
    expect(adminPage).toContain('"operations"');
    expect(adminPage).toContain("Recent operational traces");
    expect(alerts).toContain("BuildQueueBacklog");
    expect(alerts).toContain("RedisUnavailable");
    expect(alerts).toContain("DatabaseUnavailable");
    expect(alerts).toContain("RateLimitPressure");
    expect(dashboard.dashboard.title).toBe("AppForge Operations");
    expect(dashboard.dashboard.panels.length).toBeGreaterThanOrEqual(8);
  });

  it("keeps capacity, rate-limit and abuse controls explicit", () => {
    const rateLimiter = source("src/middleware/rateLimiter.ts");
    const queue = source("src/services/build-queue.ts");
    const admin = source("src/routers/admin.ts");

    expect(rateLimiter).toContain("recordRateLimitRejection");
    expect(rateLimiter).toContain("DEFAULT_LIMITS");
    expect(queue).toContain("bullmqConcurrency: 2");
    expect(queue).toContain("memoryQueueSoftLimit: 50");
    expect(admin).toContain("pendingModeration");
  });
});

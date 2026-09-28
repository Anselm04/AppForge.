import { randomUUID } from "node:crypto";

export type OperationalComponent =
  | "http"
  | "build"
  | "agent"
  | "research"
  | "planner"
  | "coder"
  | "validator"
  | "deployment"
  | "database"
  | "queue"
  | "redis"
  | "model"
  | "billing"
  | "integration"
  | "security";

export type OperationalTrace = {
  id: string;
  component: OperationalComponent;
  operation: string;
  status: "running" | "ok" | "error";
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  metadata?: Record<string, string | number | boolean | null>;
};

type MetricLabels = Record<string, string | number | boolean>;

type MetricCounter = {
  name: string;
  labels: MetricLabels;
  value: number;
};

const MAX_TRACES = 250;
const counters = new Map<string, MetricCounter>();
const gauges = new Map<string, MetricCounter>();
const traces: OperationalTrace[] = [];
const activePipelineTraces = new Map<
  string,
  ReturnType<typeof startOperationalTrace>
>();

const safeLabel = (value: string | number | boolean) =>
  String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");

function metricKey(name: string, labels: MetricLabels): string {
  return (
    name +
    "|" +
    Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(",")
  );
}

export function incrementOperationalMetric(
  name: string,
  labels: MetricLabels = {},
  amount = 1,
): void {
  const key = metricKey(name, labels);
  const current = counters.get(key);
  if (current) {
    current.value += amount;
    return;
  }
  counters.set(key, { name, labels: { ...labels }, value: amount });
}

export function setOperationalGauge(
  name: string,
  value: number,
  labels: MetricLabels = {},
): void {
  gauges.set(metricKey(name, labels), {
    name,
    labels: { ...labels },
    value: Number.isFinite(value) ? value : 0,
  });
}

export function startOperationalTrace(input: {
  component: OperationalComponent;
  operation: string;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const started = Date.now();
  const trace: OperationalTrace = {
    id: randomUUID(),
    component: input.component,
    operation: input.operation,
    status: "running",
    startedAt: new Date(started).toISOString(),
    metadata: input.metadata,
  };
  traces.push(trace);
  if (traces.length > MAX_TRACES) traces.splice(0, traces.length - MAX_TRACES);
  incrementOperationalMetric("appforge_trace_started_total", {
    component: input.component,
    operation: input.operation,
  });

  return {
    id: trace.id,
    end(
      status: "ok" | "error",
      metadata?: Record<string, string | number | boolean | null>,
    ) {
      const finished = Date.now();
      trace.status = status;
      trace.finishedAt = new Date(finished).toISOString();
      trace.durationMs = Math.max(0, finished - started);
      if (metadata) trace.metadata = { ...(trace.metadata ?? {}), ...metadata };
      incrementOperationalMetric("appforge_trace_completed_total", {
        component: input.component,
        operation: input.operation,
        status,
      });
      incrementOperationalMetric(
        "appforge_trace_duration_ms_total",
        { component: input.component, operation: input.operation },
        trace.durationMs,
      );
    },
  };
}

export function recordPipelineTraceEvent(
  agent: string,
  type: string,
  projectId: number,
): void {
  const normalized = agent.toLowerCase();
  const component: OperationalComponent =
    normalized === "research"
      ? "research"
      : normalized === "planner"
        ? "planner"
        : normalized === "coder"
          ? "coder"
          : normalized === "validator"
            ? "validator"
            : "agent";
  incrementOperationalMetric("appforge_agent_events_total", {
    agent,
    type,
  });
  incrementOperationalMetric("appforge_project_agent_events_total", {
    component,
    type,
  });
  setOperationalGauge("appforge_last_agent_project_id", projectId, {
    component,
  });

  const key = `${projectId}:${agent}`;
  const startsPhase =
    type === "start" || type === "fix_start" || type === "redesign_required";
  const completesPhase =
    type === "complete" ||
    type === "skipped" ||
    type === "failure" ||
    type === "failed" ||
    type === "requirements_fail";

  if (startsPhase) {
    const existing = activePipelineTraces.get(key);
    if (existing) existing.end("error", { replacedByNewPhase: true });
    activePipelineTraces.set(
      key,
      startOperationalTrace({
        component,
        operation: `${normalized}_phase`,
        metadata: { projectId, agent, startEvent: type },
      }),
    );
  } else if (completesPhase) {
    const existing = activePipelineTraces.get(key);
    if (existing) {
      existing.end(type === "complete" || type === "skipped" ? "ok" : "error", {
        endEvent: type,
      });
      activePipelineTraces.delete(key);
    } else {
      const instant = startOperationalTrace({
        component,
        operation: `${normalized}_phase`,
        metadata: { projectId, agent, endEvent: type },
      });
      instant.end(type === "complete" || type === "skipped" ? "ok" : "error");
    }
  }
}

export function recordModelUsage(input: {
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs: number;
  ok: boolean;
}): void {
  const labels = {
    provider: input.provider,
    model: input.model,
    status: input.ok ? "ok" : "error",
  };
  incrementOperationalMetric("appforge_model_requests_total", labels);
  incrementOperationalMetric(
    "appforge_model_request_duration_ms_total",
    { provider: input.provider, model: input.model },
    input.durationMs,
  );
  if (input.promptTokens) {
    incrementOperationalMetric(
      "appforge_model_prompt_tokens_total",
      { provider: input.provider, model: input.model },
      input.promptTokens,
    );
  }
  if (input.completionTokens) {
    incrementOperationalMetric(
      "appforge_model_completion_tokens_total",
      { provider: input.provider, model: input.model },
      input.completionTokens,
    );
  }
  if (input.totalTokens) {
    incrementOperationalMetric(
      "appforge_model_tokens_total",
      { provider: input.provider, model: input.model },
      input.totalTokens,
    );
  }
}

export function recordRateLimitRejection(tier: string): void {
  incrementOperationalMetric("appforge_rate_limit_rejections_total", { tier });
  incrementOperationalMetric("appforge_abuse_signals_total", {
    signal: "rate_limit",
  });
}

export function recordAbuseSignal(signal: string): void {
  incrementOperationalMetric("appforge_abuse_signals_total", { signal });
}

export function operationalSnapshot() {
  const memory = process.memoryUsage();
  return {
    generatedAt: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    process: {
      rssBytes: memory.rss,
      heapUsedBytes: memory.heapUsed,
      heapTotalBytes: memory.heapTotal,
      externalBytes: memory.external,
    },
    capacity: {
      maxRecentTraces: MAX_TRACES,
      recentTraceCount: traces.length,
      nodeHeapLimitSignalBytes: memory.heapTotal,
    },
    counters: [...counters.values()].map((item) => ({
      ...item,
      labels: { ...item.labels },
    })),
    gauges: [...gauges.values()].map((item) => ({
      ...item,
      labels: { ...item.labels },
    })),
    recentTraces: traces
      .slice(-50)
      .reverse()
      .map((trace) => ({
        ...trace,
        metadata: trace.metadata ? { ...trace.metadata } : undefined,
      })),
  };
}

function renderMetric(metric: MetricCounter): string {
  const labels = Object.entries(metric.labels);
  const suffix =
    labels.length === 0
      ? ""
      : `{${labels
          .map(([key, value]) => `${key}="${safeLabel(value)}"`)
          .join(",")}}`;
  return `${metric.name}${suffix} ${metric.value}`;
}

export type OperationalAlert = {
  id: string;
  severity: "warning" | "critical";
  message: string;
};

export function evaluateOperationalAlerts(): OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  const snapshot = operationalSnapshot();
  const rssLimit = Math.max(
    256,
    Number.parseInt(process.env.APPFORGE_RSS_ALERT_MB ?? "768", 10) || 768,
  );
  if (snapshot.process.rssBytes > rssLimit * 1024 * 1024) {
    alerts.push({
      id: "memory_capacity",
      severity: "warning",
      message: `Process RSS exceeds ${rssLimit} MB.`,
    });
  }

  const gaugeValue = (name: string) =>
    snapshot.gauges.find((metric) => metric.name === name)?.value;
  const queueDepth = gaugeValue("appforge_queue_depth") ?? 0;
  if (queueDepth > 100) {
    alerts.push({
      id: "queue_backlog",
      severity: "warning",
      message: "Build queue depth exceeds 100 jobs.",
    });
  }
  if (gaugeValue("appforge_database_connected") === 0) {
    alerts.push({
      id: "database_unavailable",
      severity: "critical",
      message: "Database health probe is failing.",
    });
  }
  if (
    gaugeValue("appforge_redis_connected") === 0 &&
    process.env.NODE_ENV === "production"
  ) {
    alerts.push({
      id: "redis_unavailable",
      severity: "critical",
      message: "Production Redis health probe is failing.",
    });
  }

  const rateLimitRejections = snapshot.counters
    .filter((metric) => metric.name === "appforge_rate_limit_rejections_total")
    .reduce((sum, metric) => sum + metric.value, 0);
  if (rateLimitRejections > 100) {
    alerts.push({
      id: "rate_limit_pressure",
      severity: "warning",
      message: "Rate-limit rejections exceed the operational threshold.",
    });
  }

  return alerts;
}

export function renderPrometheusMetrics(): string {
  const snapshot = operationalSnapshot();
  setOperationalGauge(
    "appforge_process_uptime_seconds",
    snapshot.uptimeSeconds,
  );
  setOperationalGauge("appforge_process_rss_bytes", snapshot.process.rssBytes);
  setOperationalGauge(
    "appforge_process_heap_used_bytes",
    snapshot.process.heapUsedBytes,
  );
  const lines = [
    "# AppForge operational metrics",
    ...[...counters.values()].map(renderMetric),
    ...[...gauges.values()].map(renderMetric),
  ];
  return lines.join("\n") + "\n";
}

export function resetOperationalObservabilityForTests(): void {
  counters.clear();
  gauges.clear();
  traces.splice(0, traces.length);
  activePipelineTraces.clear();
}

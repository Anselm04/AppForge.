/**
 * Leader-tier operations helpers — additive rewrite of leader-improvements branch intent.
 * Queue metrics, deploy readiness scoring, moderation gate helpers.
 * Complements build-queue, DeployWizard, dockerValidator, mlModeration without changing them.
 */

export type QueueBackend = "bullmq" | "redis_list" | "memory" | "unknown";

export type QueueSnapshot = {
  backend: QueueBackend;
  depth: number;
  activeWorkers: number;
  failedLastHour: number;
  healthy: boolean;
};

export type DeployReadinessScore = {
  score: number;
  max: number;
  checks: Array<{ id: string; label: string; ok: boolean; detail?: string }>;
  ready: boolean;
};

export type ModerationGate = {
  allowed: boolean;
  source: "ml" | "heuristic" | "skipped";
  category?: string;
  reason?: string;
};

/** Score deploy readiness from optional signals (env, health, docker, stripe). */
export function scoreDeployReadiness(input: {
  hasDeployUrl?: boolean;
  healthOk?: boolean | null;
  requiredEnvConfigured?: number;
  requiredEnvTotal?: number;
  dockerValidationPassed?: boolean | null;
  stripeReady?: boolean | null;
}): DeployReadinessScore {
  const checks: DeployReadinessScore["checks"] = [];

  checks.push({
    id: "deploy_url",
    label: "Deploy URL present",
    ok: !!input.hasDeployUrl,
    detail: input.hasDeployUrl ? "Live URL configured" : "No deploy URL yet",
  });

  if (input.healthOk !== undefined && input.healthOk !== null) {
    checks.push({
      id: "health",
      label: "Health check",
      ok: input.healthOk,
      detail: input.healthOk ? "Healthy" : "Unhealthy or unreachable",
    });
  }

  const envTotal = input.requiredEnvTotal ?? 0;
  const envOk = input.requiredEnvConfigured ?? 0;
  if (envTotal > 0) {
    checks.push({
      id: "env",
      label: "Environment variables",
      ok: envOk >= envTotal,
      detail: `${envOk}/${envTotal} required vars noted`,
    });
  }

  if (
    input.dockerValidationPassed !== undefined &&
    input.dockerValidationPassed !== null
  ) {
    checks.push({
      id: "docker",
      label: "Docker validation",
      ok: input.dockerValidationPassed,
      detail: input.dockerValidationPassed
        ? "Container validation passed"
        : "Container validation failed",
    });
  }

  if (input.stripeReady !== undefined && input.stripeReady !== null) {
    checks.push({
      id: "stripe",
      label: "Stripe go-live",
      ok: input.stripeReady,
      detail: input.stripeReady
        ? "Billing scaffold ready"
        : "Stripe keys / webhooks pending",
    });
  }

  const max = Math.max(checks.length, 1);
  const score = checks.filter((c) => c.ok).length;
  return {
    score,
    max,
    checks,
    ready: score === max && max > 0,
  };
}

/** Normalize queue health for dashboards / admin. */
export function normalizeQueueSnapshot(
  partial: Partial<QueueSnapshot> & { backend?: QueueBackend },
): QueueSnapshot {
  const depth = Math.max(0, partial.depth ?? 0);
  const activeWorkers = Math.max(0, partial.activeWorkers ?? 0);
  const failedLastHour = Math.max(0, partial.failedLastHour ?? 0);
  const backend = partial.backend ?? "unknown";
  const healthy =
    partial.healthy ??
    (failedLastHour < 10 && (backend === "memory" ? depth < 50 : true));
  return { backend, depth, activeWorkers, failedLastHour, healthy };
}

/** Merge ML moderation with a light heuristic keyword gate (additive only). */
export function applyModerationGate(
  text: string,
  ml?: { allowed: boolean; category?: string; reason?: string } | null,
): ModerationGate {
  if (ml) {
    return {
      allowed: ml.allowed,
      source: "ml",
      category: ml.category,
      reason: ml.reason,
    };
  }
  const lower = text.toLowerCase();
  const blocked = [
    "how to make a bomb",
    "child sexual",
    "csam",
    "bypass payment fraud",
  ];
  for (const phrase of blocked) {
    if (lower.includes(phrase)) {
      return {
        allowed: false,
        source: "heuristic",
        category: "other",
        reason: "Blocked by local safety heuristic",
      };
    }
  }
  return { allowed: true, source: "skipped" };
}

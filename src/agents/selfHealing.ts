import { logger } from "../_core/logger.js";
import { ENV } from "../_core/env.js";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { runSeniorDevAgent } from "./seniorDevAgent.js";
import type { SeniorDevTask, FileChange } from "./seniorDevAgent.js";

// ── Self-Healing Production Monitor ──
// Watches Sentry for error spikes on deployed projects.
// Auto-creates Senior Dev "autonomous" fix tasks — no user approval needed.
// Runs on a 5-minute interval via server.ts bootstrap.

const SENTRY_API_BASE = "https://sentry.io/api/0";
const ERROR_SPIKE_THRESHOLD = 5; // 5+ new errors in lookback period
const LOOKBACK_MINUTES = 60;

interface SentryIssue {
  id: string;
  title: string;
  culprit: string;
  count: number;
  level: string;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
}

interface WatcherState {
  projectId: number;
  userId: number;
  deploymentUrl?: string;
  lastKnownErrorIds: Set<string>;
  lastCheckAt: Date;
}

const watchedProjects = new Map<number, WatcherState>();

/** Add a project to the healing watchlist after deployment */
export function watchProject(
  projectId: number,
  userId: number,
  deploymentUrl?: string,
) {
  watchedProjects.set(projectId, {
    projectId,
    userId,
    deploymentUrl,
    lastKnownErrorIds: new Set(),
    lastCheckAt: new Date(),
  });
  logger.info({ projectId, deploymentUrl }, "self_healing_watch_start");
}

/** Remove from watchlist (project deleted or user opted out) */
export function unwatchProject(projectId: number) {
  watchedProjects.delete(projectId);
}

/** Fetch recent Sentry issues for a project (by tag or DSN fingerprint) */
async function fetchSentryIssues(projectId: number): Promise<SentryIssue[]> {
  const sentryToken = process.env.SENTRY_API_TOKEN ?? "";
  const orgSlug = process.env.SENTRY_ORG_SLUG ?? "";
  const projectSlug = process.env.SENTRY_PROJECT_SLUG ?? "";

  if (!sentryToken || !orgSlug || !projectSlug) {
    // Sentry API not configured — skip
    return [];
  }

  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString();
  const url = `${SENTRY_API_BASE}/projects/${orgSlug}/${projectSlug}/issues/?statsPeriod=1h&query=tags[project_id]:${projectId}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${sentryToken}` },
    });
    if (!res.ok) return [];
    const issues = (await res.json()) as SentryIssue[];
    return issues.filter((i) => new Date(i.lastSeen) >= new Date(since));
  } catch (err) {
    logger.error({ err }, "sentry_fetch_failed");
    return [];
  }
}

/** Detect error spike and auto-create fix task */
async function checkProjectForHealing(state: WatcherState) {
  const issues = await fetchSentryIssues(state.projectId);
  if (issues.length === 0) return;

  const newIssues = issues.filter((i) => !state.lastKnownErrorIds.has(i.id));
  const totalNewCount = newIssues.reduce((sum, i) => sum + i.count, 0);

  // Update known set
  for (const i of issues) state.lastKnownErrorIds.add(i.id);
  state.lastCheckAt = new Date();

  if (totalNewCount < ERROR_SPIKE_THRESHOLD) {
    logger.info(
      { projectId: state.projectId, newErrors: totalNewCount },
      "self_healing_no_spike",
    );
    return;
  }

  // SPIKE DETECTED — create autonomous fix task
  logger.warn(
    {
      projectId: state.projectId,
      newIssues: newIssues.length,
      totalCount: totalNewCount,
    },
    "self_healing_spike_detected",
  );

  const topIssue = newIssues[0];
  const request = `URGENT: Fix production error — ${topIssue.title} (${topIssue.count} occurrences). Culprit: ${topIssue.culprit}. See ${topIssue.permalink}`;

  await createAutonomousFixTask(state.projectId, state.userId, request, issues);
}

/** Create task, run Senior Dev agent in autonomous mode, save snapshot */
async function createAutonomousFixTask(
  projectId: number,
  userId: number,
  request: string,
  sentryIssues: SentryIssue[],
) {
  // 1. Get current snapshot
  const { getCurrentSnapshot } = await import("../db.js");
  const currentSnapshot = await getCurrentSnapshot(projectId);
  if (!currentSnapshot) {
    logger.error({ projectId }, "self_healing_no_snapshot");
    return;
  }

  // 2. Create task record
  const { createSeniorDevTask } = await import("../db.js");
  const taskId = await createSeniorDevTask({
    projectId,
    userId,
    request,
    mode: "autonomous",
  });

  // 3. Run agent autonomously (no approval needed)
  const task: SeniorDevTask = {
    id: taskId,
    projectId,
    userId,
    request,
    mode: "autonomous",
    plan: null,
    planApproved: true, // skip approval
    status: "executing",
    changes: [],
    validationResults: [],
    summary: "",
    creditsSpent: 0,
  };

  const files = currentSnapshot.files as Record<string, string>;
  const techStack = currentSnapshot.techStack ?? "react-node";

  const changes: FileChange[] = [];
  let summary = "";

  try {
    const result = await runSeniorDevAgent(task, files, techStack, (e) => {
      logger.info(
        { projectId, taskId, stage: e.stage, msg: e.message },
        "self_healing_progress",
      );
    });
    summary = result.summary;

    // 4. Save new snapshot as current
    const { getNextVersion, createBuildSnapshot, markSnapshotAsCurrent } =
      await import("../db.js");
    const newVersion = await getNextVersion(projectId);
    const newSnapshotId = await createBuildSnapshot({
      projectId,
      userId,
      version: newVersion,
      label: `Auto-fix v${newVersion}: ${topIssueTitle(sentryIssues)}`,
      files: result.files,
      fileCount: Object.keys(result.files).length,
      techStack,
      validationResult: result.validations,
      auditScores: null, // could run triple audit here too
      costEstimate: null,
    });
    await markSnapshotAsCurrent(newSnapshotId, projectId);

    // 5. Update project status + summary
    await db
      .update(schema.projects)
      .set({
        status: "completed",
        generatedFiles: result.files,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId));

    logger.info(
      { projectId, taskId, newVersion, summary },
      "self_healing_complete",
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ projectId, taskId, error: msg }, "self_healing_failed");
    await db
      .update(schema.seniorDevTasks)
      .set({ status: "failed", summary: `Auto-heal failed: ${msg}` })
      .where(eq(schema.seniorDevTasks.id, taskId));
  }
}

function topIssueTitle(issues: SentryIssue[]): string {
  return issues[0]?.title?.slice(0, 60) ?? "production error";
}

/** Main watcher loop — call from server.ts on startup */
export function startSelfHealingWatcher(intervalMs = 300_000) {
  const sentryToken = process.env.SENTRY_API_TOKEN ?? "";
  const orgSlug = process.env.SENTRY_ORG_SLUG ?? "";
  const projectSlug = process.env.SENTRY_PROJECT_SLUG ?? "";

  if (!ENV.sentryDsn) {
    logger.info("self_healing_disabled_no_sentry_dsn");
    return () => {};
  }

  if (!sentryToken || !orgSlug || !projectSlug) {
    logger.info(
      { hasToken: !!sentryToken, hasOrg: !!orgSlug, hasProject: !!projectSlug },
      "self_healing_disabled_missing_sentry_api_config",
    );
    return () => {};
  }

  logger.info(
    { intervalMinutes: intervalMs / 60_000 },
    "self_healing_watcher_start",
  );

  const timer = setInterval(async () => {
    for (const state of watchedProjects.values()) {
      try {
        await checkProjectForHealing(state);
      } catch (err) {
        logger.error(
          { projectId: state.projectId, err },
          "self_healing_check_error",
        );
      }
    }
  }, intervalMs);

  return () => clearInterval(timer);
}

export default startSelfHealingWatcher;

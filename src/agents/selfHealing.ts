import { logger } from "../_core/logger.js";
import { ENV } from "../_core/env.js";
import { db } from "../db.js";
import * as schema from "../db/schema.js";
import { eq } from "drizzle-orm";
import { runSeniorDevAgent } from "./seniorDevAgent.js";
import type { SeniorDevTask } from "./seniorDevAgent.js";
import { claimSeniorDevStart } from "../services/senior-dev-claim.js";
import {
  claimSelfHealingProject,
  releaseSelfHealingProject,
} from "../services/self-healing-lock.js";
import { deployValidatedProject } from "../services/productionAutoDeploy.js";

// ── Self-Healing Production Monitor ──
// Watches Sentry for error spikes on deployed/completed projects.
// Auto-creates Senior Dev autonomous fix tasks, validates them, redeploys the
// verified repair, then records a new current snapshot.

const SENTRY_API_BASE = "https://sentry.io/api/0";
const ERROR_SPIKE_THRESHOLD = 5;
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
  /** Only successfully handled issue ids are acknowledged. */
  lastKnownErrorIds: Set<string>;
  lastCheckAt: Date;
}

const watchedProjects = new Map<number, WatcherState>();

function sentryApiConfig() {
  return {
    token: process.env.SENTRY_API_TOKEN ?? process.env.SENTRY_AUTH_TOKEN ?? "",
    org: process.env.SENTRY_ORG_SLUG ?? process.env.SENTRY_ORG ?? "",
    project:
      process.env.SENTRY_PROJECT_SLUG ?? process.env.SENTRY_PROJECT ?? "",
  };
}

/** Add a project to the healing watchlist immediately after deployment. */
export function watchProject(
  projectId: number,
  userId: number,
  deploymentUrl?: string,
) {
  const existing = watchedProjects.get(projectId);
  if (existing) {
    existing.userId = userId;
    existing.deploymentUrl = deploymentUrl ?? existing.deploymentUrl;
    return;
  }
  watchedProjects.set(projectId, {
    projectId,
    userId,
    deploymentUrl,
    lastKnownErrorIds: new Set(),
    lastCheckAt: new Date(),
  });
  logger.info({ projectId, deploymentUrl }, "self_healing_watch_start");
}

/** Remove from watchlist (project deleted or user opted out). */
export function unwatchProject(projectId: number) {
  watchedProjects.delete(projectId);
}

/**
 * Rebuild the in-memory watchlist from persisted completed projects.
 * This makes autonomous recovery survive Fly machine restarts even when no
 * deployment-time watchProject() call occurred on the current machine.
 */
export async function hydrateSelfHealingWatchlist(): Promise<number> {
  const completed = await db.query.projects.findMany({
    where: eq(schema.projects.status, "completed"),
    columns: { id: true, userId: true },
  });
  const activeIds = new Set<number>();
  for (const project of completed) {
    if (!project.userId) continue;
    activeIds.add(project.id);
    watchProject(project.id, project.userId);
  }

  for (const projectId of watchedProjects.keys()) {
    if (!activeIds.has(projectId)) watchedProjects.delete(projectId);
  }
  return watchedProjects.size;
}

/** Fetch recent Sentry issues for a project tag. */
async function fetchSentryIssues(projectId: number): Promise<SentryIssue[]> {
  const { token, org, project } = sentryApiConfig();
  if (!token || !org || !project) return [];

  const since = new Date(Date.now() - LOOKBACK_MINUTES * 60_000).toISOString();
  const url = `${SENTRY_API_BASE}/projects/${org}/${project}/issues/?statsPeriod=1h&query=tags[project_id]:${projectId}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const issues = (await res.json()) as SentryIssue[];
    return issues.filter(
      (issue) => new Date(issue.lastSeen) >= new Date(since),
    );
  } catch (err) {
    logger.error({ err, projectId }, "sentry_fetch_failed");
    return [];
  }
}

export function hasEffectiveFileChange(
  before: Record<string, string>,
  after: Record<string, string>,
): boolean {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (before[key] !== after[key]) return true;
  }
  return false;
}

/** Detect an unhandled spike, claim it globally, and auto-repair it. */
async function checkProjectForHealing(state: WatcherState) {
  const issues = await fetchSentryIssues(state.projectId);
  state.lastCheckAt = new Date();
  if (issues.length === 0) return;

  const newIssues = issues.filter(
    (issue) => !state.lastKnownErrorIds.has(issue.id),
  );
  const totalNewCount = newIssues.reduce((sum, issue) => sum + issue.count, 0);

  // Do not acknowledge sub-threshold or failed repairs. Keeping them unhandled
  // lets a repeated issue accumulate to the threshold and lets failed healing
  // retry on a later cycle.
  if (totalNewCount < ERROR_SPIKE_THRESHOLD) {
    logger.info(
      { projectId: state.projectId, newErrors: totalNewCount },
      "self_healing_no_spike",
    );
    return;
  }

  const claim = await claimSelfHealingProject(state.projectId);
  if (!claim) {
    logger.info(
      { projectId: state.projectId },
      "self_healing_claim_not_acquired",
    );
    return;
  }

  try {
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
    const healed = await createAutonomousFixTask(
      state.projectId,
      state.userId,
      request,
      newIssues,
    );

    if (healed) {
      for (const issue of newIssues) state.lastKnownErrorIds.add(issue.id);
    }
  } finally {
    await releaseSelfHealingProject(claim);
  }
}

/** Create task, run Senior Dev agent, deploy the verified repair, save snapshot. */
async function createAutonomousFixTask(
  projectId: number,
  userId: number,
  request: string,
  sentryIssues: SentryIssue[],
): Promise<boolean> {
  const { getCurrentSnapshot, createSeniorDevTask } = await import("../db.js");
  const currentSnapshot = await getCurrentSnapshot(projectId);
  if (!currentSnapshot) {
    logger.error({ projectId }, "self_healing_no_snapshot");
    return false;
  }

  const project = await db.query.projects.findFirst({
    where: eq(schema.projects.id, projectId),
    columns: {
      id: true,
      title: true,
      status: true,
      productContract: true,
      requirementManifest: true,
    },
  });
  if (!project || project.status !== "completed") {
    logger.info({ projectId }, "self_healing_project_not_completed");
    return false;
  }
  if (!project.productContract) {
    logger.warn({ projectId }, "self_healing_missing_product_contract");
    return false;
  }
  if (!project.requirementManifest) {
    logger.warn({ projectId }, "self_healing_missing_requirement_manifest");
    return false;
  }

  const taskId = await createSeniorDevTask({
    projectId,
    userId,
    request,
    mode: "autonomous",
  });
  const claimed = await claimSeniorDevStart(taskId, userId);
  if (!claimed) {
    logger.warn({ projectId, taskId }, "self_healing_task_claim_failed");
    return false;
  }

  const task: SeniorDevTask = {
    id: taskId,
    projectId,
    userId,
    request,
    mode: "autonomous",
    plan: null,
    planApproved: true,
    status: "executing",
    changes: [],
    validationResults: [],
    summary: "",
    creditsSpent: 0,
  };

  const baselineFiles = {
    ...(currentSnapshot.files as Record<string, string>),
  };
  const candidateFiles = { ...baselineFiles };
  const techStack = currentSnapshot.techStack ?? "react-node";

  try {
    const result = await runSeniorDevAgent(
      task,
      candidateFiles,
      techStack,
      (event) => {
        logger.info(
          { projectId, taskId, stage: event.stage, msg: event.message },
          "self_healing_progress",
        );
      },
    );

    if (task.status !== "completed") {
      throw new Error("Autonomous repair did not finish in completed state");
    }
    if (!hasEffectiveFileChange(baselineFiles, result.files)) {
      throw new Error(
        "Autonomous repair produced no effective file change; keeping Sentry issue retryable",
      );
    }

    const {
      assertMustHaveRequirementsResolved,
      markRequirementDeployment,
      markRequirementImplementation,
      markRequirementTests,
      serializeRequirementManifest,
    } = await import("../lib/requirementManifest.js");
    let requirementManifest = markRequirementImplementation(
      assertMustHaveRequirementsResolved(project.requirementManifest),
      result.files,
    );
    requirementManifest = markRequirementTests(requirementManifest, result.files);
    requirementManifest = assertMustHaveRequirementsResolved(requirementManifest);
    result.files["appforge.requirements.json"] =
      serializeRequirementManifest(requirementManifest);

    const {
      createBuildSnapshot,
      getNextVersion,
      getSnapshotArtifact,
      markSnapshotAsCurrent,
      persistRequirementDeploymentEvidence,
    } = await import("../db.js");
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
      auditScores: null,
      costEstimate: null,
      requirementManifest,
    });
    const persistedArtifact = await getSnapshotArtifact(
      newSnapshotId,
      projectId,
    );
    if (!persistedArtifact) {
      throw new Error("Persisted self-healing artifact could not be reloaded");
    }

    // Deploy the exact immutable snapshot bytes that may become current.
    const deployment = await deployValidatedProject({
      projectId,
      projectName: project.title ?? `appforge-${projectId}`,
      files: persistedArtifact.files,
      productContract: project.productContract,
    });

    await markSnapshotAsCurrent(newSnapshotId, projectId);
    requirementManifest = markRequirementDeployment(requirementManifest, {
      destination: "fly",
      url: deployment.liveUrl,
      verified: true,
    });
    result.files["appforge.requirements.json"] =
      serializeRequirementManifest(requirementManifest);
    await persistRequirementDeploymentEvidence(projectId, requirementManifest);

    const summary = `${result.summary}\n\nProduction recovery deployed and live-verified at ${deployment.liveUrl}`;
    const { updateProjectFiles, updateProjectRequirementManifest } =
      await import("../db.js");
    await updateProjectFiles(projectId, result.files);
    await updateProjectRequirementManifest(projectId, requirementManifest);
    await db
      .update(schema.projects)
      .set({
        status: "completed",
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId));
    await db
      .update(schema.seniorDevTasks)
      .set({
        status: "completed",
        plan: task.plan,
        planApproved: true,
        changes: result.changes,
        validationResult: result.validations,
        summary,
        creditsSpent: task.creditsSpent,
        updatedAt: new Date(),
      })
      .where(eq(schema.seniorDevTasks.id, taskId));

    logger.info(
      { projectId, taskId, newVersion, liveUrl: deployment.liveUrl },
      "self_healing_complete",
    );
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ projectId, taskId, error: msg }, "self_healing_failed");
    await db
      .update(schema.seniorDevTasks)
      .set({
        status: "failed",
        plan: task.plan,
        changes: task.changes,
        validationResult: task.validationResults,
        summary: `Auto-heal failed: ${msg}`,
        creditsSpent: task.creditsSpent,
        updatedAt: new Date(),
      })
      .where(eq(schema.seniorDevTasks.id, taskId));
    return false;
  }
}

function topIssueTitle(issues: SentryIssue[]): string {
  return issues[0]?.title?.slice(0, 60) ?? "production error";
}

/** One cycle is exported so tests/operations can verify the persisted watch path. */
export async function runSelfHealingCycle(): Promise<void> {
  await hydrateSelfHealingWatchlist();
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
}

/** Main watcher loop — call from server.ts on startup. */
export function startSelfHealingWatcher(intervalMs = 300_000) {
  const { token, org, project } = sentryApiConfig();

  if (!ENV.sentryDsn) {
    logger.info("self_healing_disabled_no_sentry_dsn");
    return () => {};
  }
  if (!token || !org || !project) {
    logger.info(
      { hasToken: !!token, hasOrg: !!org, hasProject: !!project },
      "self_healing_disabled_missing_sentry_api_config",
    );
    return () => {};
  }
  if (!ENV.redisUrl) {
    logger.error("self_healing_disabled_no_shared_redis");
    return () => {};
  }

  logger.info(
    { intervalMinutes: intervalMs / 60_000 },
    "self_healing_watcher_start",
  );

  // Run once at startup so a restart does not create a full interval blind spot.
  void runSelfHealingCycle();
  const timer = setInterval(() => void runSelfHealingCycle(), intervalMs);
  return () => clearInterval(timer);
}

export default startSelfHealingWatcher;

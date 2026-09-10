import { createClient, type RedisClientType } from "redis";
import type { Queue, Worker } from "bullmq";
import { logger } from "../_core/logger.js";
import { ENV } from "../_core/env.js";
import { runBuildJob, type BuildJob } from "./build-worker.js";
import { addCredits } from "../db.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { getLatestTerminalBuildEvent } from "./build-event-store.js";

let redisClient: RedisClientType | null = null;
const memoryQueue: BuildJob[] = [];
const memoryQueuedProjects = new Set<number>();
let memoryWorkerRunning = false;
let bullWorker: Worker | null = null;
let bullQueue: Queue | null = null;

const QUEUE_KEY = "appforge:build:queue";
const BULL_QUEUE_NAME = "appforge-builds";
const queueClaimKey = (projectId: number) =>
  `appforge:build:queued:${projectId}`;
const isTerminalEvent = (event: string) => event === "done" || event === "error";

async function refundDuplicateReservation(job: BuildJob): Promise<void> {
  if (!job.reservationCharged) return;
  try {
    await addCredits(
      job.userId,
      BUILD_CREDIT_COST,
      "build_refund",
      `Duplicate build reservation refund for project ${job.projectId}`,
      `build-duplicate-refund-${job.projectId}-${job.createdAt}`,
    );
  } catch (err) {
    logger.error(
      { err, projectId: job.projectId },
      "duplicate_build_refund_failed",
    );
  }
}

async function getRedis(): Promise<RedisClientType | null> {
  if (!ENV.redisUrl) return null;
  if (!redisClient) {
    redisClient = createClient({ url: ENV.redisUrl }) as RedisClientType;
    redisClient.on("error", (err) =>
      logger.error({ err }, "build_queue_redis_error"),
    );
    await redisClient.connect();
    logger.info("Build queue Redis connected");
  }
  return redisClient;
}

async function initBullMQ(): Promise<boolean> {
  if (bullQueue) return true;
  if (!ENV.redisUrl) return false;
  try {
    const { Queue, Worker } = await import("bullmq");
    const connection = { url: ENV.redisUrl };
    bullQueue = new Queue(BULL_QUEUE_NAME, { connection });
    bullWorker = new Worker(
      BULL_QUEUE_NAME,
      async (job) => {
        await runBuildJob(job.data as BuildJob);
      },
      { connection, concurrency: 2 },
    );
    bullWorker.on(
      "failed",
      (job: { data?: BuildJob } | undefined, err: Error) => {
        logger.error(
          { err, projectId: (job?.data as BuildJob)?.projectId },
          "bullmq_job_failed",
        );
      },
    );
    logger.info("BullMQ build worker started");
    return true;
  } catch (err) {
    logger.warn({ err }, "bullmq_unavailable_fallback_redis_list");
    return false;
  }
}

async function processMemoryQueue(): Promise<void> {
  if (memoryWorkerRunning) return;
  memoryWorkerRunning = true;
  while (memoryQueue.length > 0) {
    const job = memoryQueue.shift();
    if (job) {
      try {
        await runBuildJob(job);
      } catch (err) {
        logger.error(
          { err, projectId: job.projectId },
          "memory_queue_job_failed",
        );
      } finally {
        memoryQueuedProjects.delete(job.projectId);
      }
    }
  }
  memoryWorkerRunning = false;
}

async function processRedisQueue(): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  const raw = await redis.rPop(QUEUE_KEY);
  if (!raw) return;
  let job: BuildJob | null = null;
  try {
    job = JSON.parse(raw) as BuildJob;
    await runBuildJob(job);
  } catch (err) {
    logger.error({ err }, "redis_queue_job_failed");
  } finally {
    if (job) await redis.del(queueClaimKey(job.projectId));
  }
}

export function startBuildQueueWorker(intervalMs = 2000): () => void {
  void initBullMQ();
  const timer = setInterval(() => {
    if (!bullWorker) {
      void processRedisQueue();
      void processMemoryQueue();
    }
  }, intervalMs);
  logger.info({ intervalMs }, "build_queue_worker_started");
  return () => {
    clearInterval(timer);
    void bullWorker?.close();
    bullWorker = null;
    bullQueue = null;
  };
}

export async function enqueueBuild(job: BuildJob): Promise<void> {
  if (!bullQueue) await initBullMQ();

  if (bullQueue) {
    try {
      const queued = await bullQueue.add("build", job, {
        jobId: `build-${job.projectId}`,
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 1,
      });
      const queuedData = queued.data as BuildJob;
      if (queuedData.createdAt !== job.createdAt) {
        logger.warn(
          { projectId: job.projectId },
          "duplicate_build_enqueue_blocked_bullmq",
        );
        await refundDuplicateReservation(job);
        return;
      }
      logger.info({ projectId: job.projectId }, "build_enqueued_bullmq");
      return;
    } catch (err) {
      logger.error(
        { err, projectId: job.projectId },
        "build_enqueue_bullmq_failed_fallback",
      );
    }
  }

  try {
    const redis = await getRedis();
    if (redis) {
      const claimed = await redis.set(
        queueClaimKey(job.projectId),
        job.createdAt,
        { NX: true, EX: 1800 },
      );
      if (!claimed) {
        logger.warn(
          { projectId: job.projectId },
          "duplicate_build_enqueue_blocked_redis",
        );
        await refundDuplicateReservation(job);
        return;
      }
      try {
        await redis.lPush(QUEUE_KEY, JSON.stringify(job));
      } catch (err) {
        await redis.del(queueClaimKey(job.projectId));
        throw err;
      }
      logger.info({ projectId: job.projectId }, "build_enqueued_redis");
      return;
    }
  } catch (err) {
    logger.error(
      { err, projectId: job.projectId },
      "build_enqueue_redis_failed_fallback_memory",
    );
  }

  if (memoryQueuedProjects.has(job.projectId)) {
    logger.warn(
      { projectId: job.projectId },
      "duplicate_build_enqueue_blocked_memory",
    );
    await refundDuplicateReservation(job);
    return;
  }
  memoryQueuedProjects.add(job.projectId);
  memoryQueue.push(job);
  logger.warn(
    { projectId: job.projectId },
    "build_enqueued_memory_degraded_mode",
  );
  void processMemoryQueue();
}

export async function publishBuildEvent(
  projectId: number,
  event: string,
  data: unknown,
): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  await redis.publish(
    `appforge:build:${projectId}`,
    JSON.stringify({ event, data }),
  );
}

export async function subscribeBuildEvents(
  projectId: number,
  handler: (event: string, data: unknown) => void,
): Promise<() => void> {
  const redis = await getRedis();
  if (!redis) return () => {};

  const sub = redis.duplicate() as RedisClientType;
  let active = true;
  let closing: Promise<void> | null = null;
  await sub.connect();
  const channel = `appforge:build:${projectId}`;

  const closeSubscription = (): Promise<void> => {
    if (closing) return closing;
    if (!active) return Promise.resolve();
    active = false;
    closing = (async () => {
      try {
        await sub.unsubscribe(channel);
      } finally {
        if (sub.isOpen) await sub.quit();
      }
    })();
    return closing;
  };

  await sub.subscribe(channel, (message) => {
    if (!active) return;
    try {
      const parsed = JSON.parse(message) as { event: string; data: unknown };
      handler(parsed.event, parsed.data);
      if (isTerminalEvent(parsed.event)) void closeSubscription();
    } catch {
      logger.warn({ projectId }, "build_event_message_invalid");
    }
  });

  // Subscribe first, then read persisted terminal state. The worker stores each
  // event before Redis publication, so this closes the cross-instance gap
  // between the route's historical replay and Redis subscription setup. A
  // terminal result self-closes so route-level close timing cannot leak a sub.
  try {
    const terminal = await getLatestTerminalBuildEvent(projectId);
    if (active && terminal) {
      handler(terminal.event, terminal.payload);
      await closeSubscription();
    }
  } catch (error: unknown) {
    logger.error(
      { projectId, error },
      "redis_build_terminal_catchup_failed",
    );
  }

  return closeSubscription;
}

export async function closeBuildQueue(): Promise<void> {
  if (bullWorker) {
    await bullWorker.close();
    bullWorker = null;
    bullQueue = null;
  }
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

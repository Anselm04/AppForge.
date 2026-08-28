import { createClient, type RedisClientType } from "redis";
import type { Queue, Worker } from "bullmq";
import { logger } from "../_core/logger.js";
import { ENV } from "../_core/env.js";
import { runBuildJob, type BuildJob } from "./build-worker.js";

let redisClient: RedisClientType | null = null;
const memoryQueue: BuildJob[] = [];
let memoryWorkerRunning = false;
let bullWorker: Worker | null = null;
let bullQueue: Queue | null = null;

const QUEUE_KEY = "appforge:build:queue";
const BULL_QUEUE_NAME = "appforge-builds";

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

/** Prefer BullMQ when available — durable jobs, retries, horizontal workers. */
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
  try {
    const job = JSON.parse(raw) as BuildJob;
    await runBuildJob(job);
  } catch (err) {
    logger.error({ err }, "redis_queue_job_failed");
  }
}

/** Start background worker loop (BullMQ, Redis list, or in-memory). */
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
  if (!bullQueue) {
    await initBullMQ();
  }
  if (bullQueue) {
    await bullQueue.add("build", job, {
      jobId: `build-${job.projectId}-${Date.now()}`,
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
    });
    logger.info({ projectId: job.projectId }, "build_enqueued_bullmq");
    return;
  }

  const redis = await getRedis();
  if (redis) {
    await redis.lPush(QUEUE_KEY, JSON.stringify(job));
    logger.info({ projectId: job.projectId }, "build_enqueued_redis");
    return;
  }
  memoryQueue.push(job);
  logger.info({ projectId: job.projectId }, "build_enqueued_memory");
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
  await sub.connect();
  const channel = `appforge:build:${projectId}`;
  await sub.subscribe(channel, (message) => {
    try {
      const parsed = JSON.parse(message) as { event: string; data: unknown };
      handler(parsed.event, parsed.data);
    } catch {
      /* ignore */
    }
  });
  return async () => {
    await sub.unsubscribe(channel);
    await sub.quit();
  };
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

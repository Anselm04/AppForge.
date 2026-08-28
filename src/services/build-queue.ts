import { createClient, type RedisClientType } from "redis";
import { logger } from "../_core/logger.js";
import { ENV } from "../_core/env.js";
import { runBuildJob, type BuildJob } from "./build-worker.js";

let redisClient: RedisClientType | null = null;
const memoryQueue: BuildJob[] = [];
let memoryWorkerRunning = false;

const QUEUE_KEY = "appforge:build:queue";

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
  // Non-blocking drain — one job per tick
  const raw = await redis.rPop(QUEUE_KEY);
  if (!raw) return;
  try {
    const job = JSON.parse(raw) as BuildJob;
    await runBuildJob(job);
  } catch (err) {
    logger.error({ err }, "redis_queue_job_failed");
  }
}

/** Start background worker loop (Redis or in-memory). */
export function startBuildQueueWorker(intervalMs = 2000): () => void {
  const timer = setInterval(() => {
    void processRedisQueue();
    void processMemoryQueue();
  }, intervalMs);
  logger.info({ intervalMs }, "build_queue_worker_started");
  return () => clearInterval(timer);
}

export async function enqueueBuild(job: BuildJob): Promise<void> {
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
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

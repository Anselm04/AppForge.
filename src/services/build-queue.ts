import { createClient } from "redis";
import { logger } from "../_core/logger.js";
import { ENV } from "../_core/env.js";

// ── Async Build Queue (Redis-backed) ──
// This is a stub implementation. To go fully async:
// 1. Install bullmq: npm install bullmq
// 2. Replace this with BullMQ Queue + Worker
// 3. SSE stream reads from Redis pub/sub channel instead of synchronous HTTP

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redisClient && ENV.redisUrl) {
    redisClient = createClient({ url: ENV.redisUrl });
    await redisClient.connect();
    logger.info("Build queue Redis connected");
  }
  return redisClient;
}

interface BuildJob {
  projectId: number;
  userId: number;
  description: string;
  techStack: string;
  createdAt: string;
}

export async function enqueueBuild(job: BuildJob): Promise<void> {
  const redis = await getRedis();
  if (!redis) {
    logger.warn("No REDIS_URL configured — builds run synchronously (not queued)");
    return;
  }
  await redis.lPush("appforge:build:queue", JSON.stringify(job));
  logger.info({ projectId: job.projectId }, "build_enqueued");
}

export async function dequeueBuild(): Promise<BuildJob | null> {
  const redis = await getRedis();
  if (!redis) return null;
  const raw = await redis.rPop("appforge:build:queue");
  if (!raw) return null;
  return JSON.parse(raw) as BuildJob;
}

export async function publishBuildEvent(projectId: number, event: string, data: unknown): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  await redis.publish(`appforge:build:${projectId}`, JSON.stringify({ event, data }));
}

export async function closeBuildQueue(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
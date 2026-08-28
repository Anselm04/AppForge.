// ── Build events (optional Redis pub/sub for future async workers) ──
// Builds run synchronously on the SSE connection (see src/routes/build.ts).
// Set BUILD_SSE_TIMEOUT_MS (default 20 min) for long validations.
// enqueueBuild/dequeueBuild are reserved for a future BullMQ worker — not used today.

import { createClient } from "redis";
import { logger } from "../_core/logger.js";
import { ENV } from "../_core/env.js";

let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedis() {
  if (!redisClient && ENV.redisUrl) {
    redisClient = createClient({ url: ENV.redisUrl });
    await redisClient.connect();
    logger.info("Build queue Redis connected (pub/sub only)");
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

/** Reserved for future async worker — currently a no-op. */
export async function enqueueBuild(job: BuildJob): Promise<void> {
  const redis = await getRedis();
  if (!redis) return;
  await redis.lPush("appforge:build:queue", JSON.stringify(job));
  logger.info({ projectId: job.projectId }, "build_enqueued_future_worker");
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

export async function closeBuildQueue(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

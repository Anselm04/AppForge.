/** Dedicated build consumer entry point. Never starts an HTTP listener. */
import "../db.js";
import { ENV } from "../_core/env.js";
import { logger } from "../_core/logger.js";
import { ensureAppSchema } from "../db/ensureSchema.js";
import { closeDbConnection } from "../db.js";
import { validateEnv } from "../utils/env-validator.js";
import { checkSharedRedis } from "../middleware/rateLimiter.js";
import { startBuildQueueWorker } from "./build-queue.js";

let stop: (() => void) | undefined;
let stopping = false;

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, "build_worker_shutdown");
  stop?.();
  await closeDbConnection();
  process.exit(0);
}

async function main(): Promise<void> {
  if (!ENV.redisUrl || !process.env.REDIS_URL?.trim()) {
    throw new Error("Dedicated build workers require REDIS_URL; in-memory jobs cannot be shared across API instances");
  }
  const validation = validateEnv(process.env as any);
  if (ENV.isProduction && !validation.valid) {
    throw new Error(`Invalid production worker environment: ${validation.errors.join("; ")}`);
  }
  await ensureAppSchema();
  if (!(await checkSharedRedis())) {
    throw new Error("Shared Redis is unavailable; refusing to start a disconnected worker");
  }
  stop = startBuildQueueWorker(2000);
  logger.info({}, "dedicated_build_worker_started");
}

process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("unhandledRejection", (error) => {
  logger.error({ error }, "build_worker_unhandled_rejection");
  process.exitCode = 1;
  void shutdown("unhandledRejection");
});

void main().catch((error) => {
  logger.error({ error }, "dedicated_build_worker_start_failed");
  process.exit(1);
});

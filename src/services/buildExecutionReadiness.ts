import { TRPCError } from "@trpc/server";
import { dockerBuildAvailable } from "../lib/dockerValidator.js";
import {
  assertRuntimeProviderAllowed,
  isolatedRuntimeConfig,
} from "./isolatedRuntimeConfig.js";

export const BUILD_RUNTIME_UNAVAILABLE_MESSAGE =
  "Builds are temporarily unavailable while the secure build runtime is being configured. Your saved projects are preserved. No new build will start until it is available.";

export class BuildRuntimeUnavailableError extends TRPCError {
  constructor() {
    super({
      code: "SERVICE_UNAVAILABLE",
      message: BUILD_RUNTIME_UNAVAILABLE_MESSAGE,
    });
  }
}

/** Reject before credit reservations and model calls, and recheck dequeued jobs. */
export async function assertBuildExecutionReady(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  const config = isolatedRuntimeConfig("build");
  if (config) {
    try {
      const endpoint = new URL(config.url);
      assertRuntimeProviderAllowed(endpoint);
      if (
        endpoint.protocol === "https:" &&
        !endpoint.username &&
        !endpoint.password
      )
        return;
    } catch {
      /* Invalid or forbidden runtime configuration fails closed. */
    }
    throw new BuildRuntimeUnavailableError();
  }
  if (await dockerBuildAvailable()) return;
  throw new BuildRuntimeUnavailableError();
}

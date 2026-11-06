import { currentBuildExecutionLease } from "./buildExecutionLease.js";
import { appendBuildEvent } from "./build-event-store.js";

type UsageSample = {
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  succeeded: boolean;
};

function countedTokens(value: number | undefined): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? (value as number)
    : null;
}

/**
 * Records observed provider token counts per running build, without prompts,
 * API keys or payment information. This is evidence, not a billed USD price.
 * Missing token counts and retries MUST NOT be silently treated as zero cost.
 */
export async function recordProviderUsageForCurrentBuild(
  sample: UsageSample,
): Promise<boolean> {
  const lease = currentBuildExecutionLease();
  if (!lease) return false;
  await appendBuildEvent(lease.projectId, "provider_usage", {
    executionId: lease.executionId,
    userId: lease.userId,
    provider: sample.provider.slice(0, 100),
    model: sample.model.slice(0, 150),
    promptTokens: countedTokens(sample.promptTokens),
    completionTokens: countedTokens(sample.completionTokens),
    totalTokens: countedTokens(sample.totalTokens),
    succeeded: sample.succeeded,
    costUsdCents: null,
    costVerified: false,
    capturedAt: new Date().toISOString(),
  });
  return true;
}

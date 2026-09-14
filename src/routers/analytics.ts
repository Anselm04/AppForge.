import { router, protectedProcedure } from "../_core/trpc.js";
import { getUserBuildStats } from "../db/buildStats.js";
import { countBuildsThisMonth, getUserTier, getTierBuildLimit } from "../db.js";

function safePercent(numerator: number, denominator: number): number | null {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return null;
  }
  return Math.max(
    0,
    Math.min(100, Math.round((numerator / denominator) * 100)),
  );
}

export const analyticsRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getUserBuildStats(ctx.user.id);
    const tier = await getUserTier(ctx.user.id);
    const buildsThisMonth = Math.max(0, await countBuildsThisMonth(ctx.user.id));
    const rawLimit = getTierBuildLimit(tier);
    const totalBuilds = Math.max(0, stats?.totalBuilds ?? 0);
    const successfulBuilds = Math.max(0, stats?.successfulBuilds ?? 0);
    const failedBuilds = Math.max(0, stats?.failedBuilds ?? 0);
    const finiteLimit =
      typeof rawLimit === "number" && Number.isFinite(rawLimit)
        ? Math.max(0, rawLimit)
        : null;

    return {
      tier,
      buildsThisMonth,
      monthlyBuildLimit: finiteLimit,
      remainingBuilds:
        finiteLimit !== null
          ? Math.max(0, finiteLimit - buildsThisMonth)
          : null,
      monthlyBuildUtilizationPercent:
        finiteLimit !== null && finiteLimit > 0
          ? safePercent(buildsThisMonth, finiteLimit)
          : null,
      totalBuilds,
      successfulBuilds,
      failedBuilds,
      totalCreditsSpent: Math.max(0, stats?.totalCreditsSpent ?? 0),
      totalDeploys: Math.max(0, stats?.totalDeploys ?? 0),
      successRate: safePercent(successfulBuilds, totalBuilds),
      failureRate: safePercent(failedBuilds, totalBuilds),
    };
  }),
});

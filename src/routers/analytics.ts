import { router, protectedProcedure } from "../_core/trpc.js";
import { getUserBuildStats } from "../db/buildStats.js";
import { countBuildsThisMonth, getUserTier, getTierBuildLimit } from "../db.js";

export const analyticsRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const stats = await getUserBuildStats(ctx.user.id);
    const tier = await getUserTier(ctx.user.id);
    const buildsThisMonth = await countBuildsThisMonth(ctx.user.id);
    const limit = getTierBuildLimit(tier);
    return {
      tier,
      buildsThisMonth,
      monthlyBuildLimit: limit,
      totalBuilds: stats?.totalBuilds ?? 0,
      successfulBuilds: stats?.successfulBuilds ?? 0,
      failedBuilds: stats?.failedBuilds ?? 0,
      totalCreditsSpent: stats?.totalCreditsSpent ?? 0,
      totalDeploys: stats?.totalDeploys ?? 0,
      successRate:
        stats && stats.totalBuilds > 0
          ? Math.round((stats.successfulBuilds / stats.totalBuilds) * 100)
          : null,
    };
  }),
});

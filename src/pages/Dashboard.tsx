import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { useNavigate } from "react-router-dom";
import { useSession } from "../lib/auth.js";
import { CreditsPauseBanner } from "../components/CreditsPauseBanner.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { useLocale } from "../i18n/LocaleContext.js";
import { Button } from "../design-system/Button.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { Badge } from "../design-system/Badge.js";

interface TierStatus {
  tier: string;
  isPaid: boolean;
  buildsThisMonth: number;
  limit: number | null;
  credits: number;
}

interface Project {
  id: number;
  title: string | null;
  description: string | null;
  status: string | null;
  createdAt: string | null;
}

export function Dashboard() {
  const navigate = useNavigate();
  const session = useSession();
  const { t } = useLocale();

  useEffect(() => {
    if (!session) {
      navigate("/login?next=/dashboard", { replace: true });
    }
  }, [session, navigate]);

  const {
    data: projects,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["projects", "list"],
    queryFn: () => trpc.projects.list.query(),
    enabled: !!session,
    retry: false,
  });

  const { data: tierStatus } = useQuery({
    queryKey: ["projects", "tierStatus"],
    queryFn: () => trpc.projects.tierStatus.query(),
    enabled: !!session,
    retry: false,
  });

  const { data: analytics } = useQuery({
    queryKey: ["analytics", "me"],
    queryFn: () => trpc.analytics.me.query(),
    enabled: !!session,
    retry: false,
  });

  const unauthError =
    isError &&
    /unauth|not authenticated/i.test(String((error as Error)?.message || ""));

  if (!session || unauthError) {
    return (
      <div className="p-6 md:p-8">
        <GlassCard className="max-w-lg mx-auto text-center py-16" hover={false}>
          <p className="text-forge-text-muted text-lg mb-6">
            {t("dashboard.signInPrompt")}
          </p>
          <Button onClick={() => navigate("/login?next=/dashboard")}>
            {t("dashboard.signIn")}
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {tierStatus && (
          <GlassCard
            hover={false}
            className="flex flex-wrap items-center gap-6 justify-between"
          >
            <div>
              <span className="text-sm text-forge-text-muted">
                {t("dashboard.currentPlan")}
              </span>
              <p className="font-semibold text-forge-text-primary capitalize flex items-center gap-2">
                {tierStatus.tier}
                {tierStatus.isPaid && tierStatus.tier !== "free" && (
                  <Badge tone="success">{t("dashboard.active")}</Badge>
                )}
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm text-forge-text-muted">
                {t("dashboard.buildsThisMonth")}
              </span>
              <p className="font-semibold text-forge-text-primary">
                {tierStatus.buildsThisMonth}
                {tierStatus.limit !== null ? ` / ${tierStatus.limit}` : " / ∞"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-sm text-forge-text-muted">
                {t("dashboard.credits")}
              </span>
              <p className="font-semibold text-forge-cyan">
                {tierStatus.credits ?? 0}
              </p>
            </div>
            {(tierStatus.tier === "free" ||
              (tierStatus.credits ?? 0) < BUILD_CREDIT_COST) && (
              <Button size="sm" onClick={() => navigate("/pricing")}>
                {(tierStatus.credits ?? 0) < BUILD_CREDIT_COST
                  ? t("dashboard.getCredits")
                  : t("dashboard.upgrade")}
              </Button>
            )}
          </GlassCard>
        )}

        {analytics && analytics.totalBuilds > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label={t("dashboard.stats.totalBuilds")}
              value={analytics.totalBuilds}
            />
            <StatCard
              label={t("dashboard.stats.successful")}
              value={analytics.successfulBuilds}
            />
            <StatCard
              label={t("dashboard.stats.successRate")}
              value={
                analytics.successRate != null
                  ? `${analytics.successRate}%`
                  : "—"
              }
            />
            <StatCard
              label={t("dashboard.stats.deploys")}
              value={analytics.totalDeploys}
            />
          </div>
        )}

        {tierStatus && (tierStatus.credits ?? 0) < BUILD_CREDIT_COST && (
          <CreditsPauseBanner
            credits={tierStatus.credits ?? 0}
            cost={BUILD_CREDIT_COST}
            action="build or improve apps"
          />
        )}

        <div className="flex flex-wrap justify-between items-center gap-4">
          <h1 className="forge-h2 text-forge-text-primary">
            {t("dashboard.myApps")}
          </h1>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/redeem")}
            >
              {t("dashboard.redeemCode")}
            </Button>
            <Button size="sm" onClick={() => navigate("/app/new")}>
              + {t("dashboard.newApp")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-forge-text-muted">{t("common.loading")}</p>
        ) : projects?.length === 0 ? (
          <GlassCard className="text-center py-16" hover={false}>
            <p className="text-forge-text-muted text-lg mb-6">
              {t("dashboard.noApps")}
            </p>
            <Button onClick={() => navigate("/app/new")}>
              {t("dashboard.createFirst")}
            </Button>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map((project: Project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const { t } = useLocale();

  const statusTone: Record<string, "success" | "cyan" | "gold" | "default"> = {
    completed: "success",
    failed: "default",
    running: "cyan",
    pending: "gold",
    paused: "gold",
  };

  const canImprove =
    project.status === "completed" || project.status === "paused";

  return (
    <GlassCard className="flex flex-col h-full">
      <h3 className="font-semibold text-lg text-forge-text-primary mb-2">
        {project.title}
      </h3>
      <p className="text-sm text-forge-text-muted mb-4 line-clamp-2 flex-1">
        {project.description}
      </p>
      <div className="flex items-center justify-between mb-4">
        <Badge tone={statusTone[project.status ?? "pending"] ?? "default"}>
          {project.status}
        </Badge>
        <p className="text-xs text-forge-text-muted">
          {project.createdAt
            ? new Date(project.createdAt).toLocaleDateString()
            : "—"}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 text-xs"
          onClick={() => navigate(`/build/${project.id}`)}
        >
          {t("dashboard.viewBuild")}
        </Button>
        {canImprove && (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 text-xs"
            onClick={() =>
              navigate(`/ai-builder?projectId=${project.id}&mode=improve`)
            }
          >
            {t("dashboard.improve")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={() => navigate("/app/new")}
        >
          {t("dashboard.newBuild")}
        </Button>
      </div>
    </GlassCard>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <GlassCard padding="sm" hover={false}>
      <p className="text-xs text-forge-text-muted">{label}</p>
      <p className="text-2xl font-semibold text-forge-text-primary mt-1">
        {value}
      </p>
    </GlassCard>
  );
}

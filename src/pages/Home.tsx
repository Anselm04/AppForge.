import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { trpc } from "../utils/trpc.js";
import {
  ensureFreshSession,
  getAccessToken,
  loginPathWithReturn,
  refreshSession,
} from "../lib/auth.js";
import { CreditsPauseBanner } from "../components/CreditsPauseBanner.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { PROMPT_MAX_CHARS } from "../lib/prompt.js";
import { HcaptchaWidget } from "../components/HcaptchaWidget.js";
import {
  clearPromptDraft,
  readPromptDraft,
  writePromptDraft,
} from "../lib/promptDraft.js";
import { useLocale } from "../i18n/LocaleContext.js";
import { PRODUCTION_READY_STACK } from "../lib/productionPreset.js";

/** Sensible production default when the user no longer picks a stack on Home. */
const DEFAULT_TECH_STACK = PRODUCTION_READY_STACK;

export function Home() {
  const [description, setDescription] = useState(() => readPromptDraft());
  const [isBuilding, setIsBuilding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null);

  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const retriedAuth = useRef(false);
  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
    staleTime: 0,
  });
  const { data: tierStatus } = useQuery({
    queryKey: ["projects", "tierStatus"],
    queryFn: () => trpc.projects.tierStatus.query(),
    enabled: !!user,
  });

  useEffect(() => {
    writePromptDraft(description);
  }, [description]);

  const createProjectMutation = useMutation({
    mutationFn: () =>
      trpc.projects.create.mutate({
        title: description.slice(0, 60) || "Untitled App",
        description,
        techStack: DEFAULT_TECH_STACK,
        hcaptchaToken: hcaptchaToken ?? undefined,
        locale,
      }),
    onSuccess: (data) => {
      clearPromptDraft();
      setIsBuilding(true);
      navigate(`/build/${data.id}`);
    },
    onError: async (err) => {
      const message = err instanceof Error ? err.message : String(err);
      const code =
        (
          err as {
            data?: { code?: string };
            shape?: { data?: { code?: string } };
          }
        )?.data?.code ??
        (err as { shape?: { data?: { code?: string } } })?.shape?.data?.code;
      writePromptDraft(description);
      if (code === "UNAUTHORIZED" || /not authenticated/i.test(message)) {
        if (!retriedAuth.current) {
          retriedAuth.current = true;
          const refreshed = await refreshSession();
          if (refreshed) {
            createProjectMutation.mutate();
            return;
          }
        }
        setFormError(t("home.needAccount"));
        navigate(loginPathWithReturn("/"));
        return;
      }
      setFormError(message || t("home.generateFailed"));
    },
  });

  const creditBalance = tierStatus?.credits ?? 0;
  const outOfCredits =
    !!user &&
    tierStatus !== undefined &&
    !tierStatus.unlimited &&
    creditBalance < BUILD_CREDIT_COST;

  const overLimit = description.length > PROMPT_MAX_CHARS;

  const handleStartBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!description.trim() || overLimit) return;
    writePromptDraft(description);
    const session = await ensureFreshSession();
    if (!session && !getAccessToken()) {
      navigate(loginPathWithReturn("/"));
      return;
    }
    createProjectMutation.mutate();
  };

  const generateDisabled =
    !description.trim() ||
    createProjectMutation.isPending ||
    overLimit ||
    isBuilding;

  return (
    <div className="min-h-[calc(100vh-4rem)] forge-circuit-bg">
      <div className="forge-container pt-12 pb-24 sm:pt-16 md:pt-20">
        <div className="text-center mb-16 md:mb-20">
          <div className="forge-hero-circuit mx-auto mb-10">
            <img
              src="/appforge-logo.png"
              alt="AppForge"
              width={512}
              height={512}
              decoding="async"
              className="relative z-[1] h-56 w-56 sm:h-64 sm:w-64 md:h-72 md:w-72 lg:h-80 lg:w-80 xl:h-[22rem] xl:w-[22rem] 2xl:h-96 2xl:w-96 object-contain forge-logo-glow"
            />
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-forge-text-primary mb-4">
            <span className="forge-gradient-text">AppForge</span>
          </h1>
          <p className="text-lg sm:text-xl text-forge-text-muted max-w-2xl mx-auto leading-relaxed">
            {t("home.tagline")}
          </p>
        </div>

        {tierStatus && (
          <div className="forge-card-metallic p-4 mb-8 max-w-2xl mx-auto text-center">
            <p className="text-forge-text-primary font-semibold">
              {tierStatus.tier === "free"
                ? t("home.planFree", {
                    remaining: tierStatus.remaining ?? 0,
                    credits: tierStatus.credits ?? 0,
                  })
                : tierStatus.tier === "starter"
                  ? t("home.planStarter", {
                      remaining: tierStatus.remaining ?? 0,
                      credits: tierStatus.credits ?? 0,
                    })
                  : tierStatus.tier === "builder"
                    ? t("home.planBuilder", {
                        remaining: tierStatus.remaining ?? 0,
                        credits: tierStatus.credits ?? 0,
                      })
                    : tierStatus.tier === "studio"
                      ? t("home.planStudio", {
                          credits: tierStatus.credits ?? 0,
                        })
                      : t("home.planEnterprise")}
            </p>
            {tierStatus.tier === "free" && (
              <a
                href="/pricing"
                className="text-[color:var(--forge-gold-deep)] hover:text-forge-gold text-sm mt-2 inline-block font-medium"
              >
                {t("home.upgradeMore")}
              </a>
            )}
          </div>
        )}

        {outOfCredits && (
          <div className="max-w-2xl mx-auto mb-8">
            <CreditsPauseBanner
              credits={creditBalance}
              cost={BUILD_CREDIT_COST}
              action={t("credits.actionStartBuild")}
            />
          </div>
        )}

        <div className="forge-card-metallic p-6 sm:p-8 max-w-2xl mx-auto">
          <form onSubmit={handleStartBuild} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-forge-text-primary mb-3 tracking-wide">
                {t("home.promptLabel")}
              </label>
              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value.slice(0, PROMPT_MAX_CHARS))
                }
                maxLength={PROMPT_MAX_CHARS}
                placeholder={t("home.promptPlaceholder")}
                className="forge-input h-44 px-5 py-4 resize-none text-base leading-relaxed"
              />
              <p
                className={`text-xs mt-2 ${overLimit ? "text-amber-800 font-semibold" : "text-forge-text-muted"}`}
              >
                {t("home.charCount", { count: description.length })}
              </p>
              {overLimit && (
                <p className="text-sm text-amber-800 mt-1">{t("home.overLimit")}</p>
              )}
            </div>

            <HcaptchaWidget onToken={setHcaptchaToken} />

            {(formError || createProjectMutation.isError) && (
              <p className="text-sm text-amber-800">
                {formError ||
                  String((createProjectMutation.error as Error)?.message || "")}
              </p>
            )}
            <button
              type="submit"
              disabled={generateDisabled}
              className="forge-btn-gold w-full py-4 px-8 text-lg"
            >
              {outOfCredits
                ? t("home.pausedCta")
                : createProjectMutation.isPending || isBuilding
                  ? t("home.creating")
                  : t("home.generate")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

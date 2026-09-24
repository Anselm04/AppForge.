import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { CreditsPauseBanner } from "../components/CreditsPauseBanner.js";
import { HcaptchaWidget } from "../components/HcaptchaWidget.js";
import { useLocale } from "../i18n/LocaleContext.js";
import {
  ensureFreshSession,
  getAccessToken,
  loginPathWithReturn,
  refreshSession,
} from "../lib/auth.js";
import type { BuildCapabilityId } from "../lib/buildCapabilities.js";
import type {
  ClarificationRequest,
  ProductType,
} from "../lib/productContract.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { PROMPT_MAX_CHARS } from "../lib/prompt.js";
import {
  clearPromptDraft,
  readPromptDraft,
  writePromptDraft,
} from "../lib/promptDraft.js";
import {
  detectIncomeIntent,
  suggestCapabilitiesForIncome,
} from "../lib/revenueReadiness.js";
import { trpc } from "../utils/trpc.js";

// Home never picks a stack. projects.create derives it from the canonical
// product contract (game -> Phaser, mobile -> Expo, API -> service, ...), so
// sending a fixed web stack here would reject or mis-build non-web products.

export function Home() {
  const [description, setDescription] = useState(() => readPromptDraft());
  const [isBuilding, setIsBuilding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [clarification, setClarification] =
    useState<ClarificationRequest | null>(null);
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null);
  const [buildCapabilities, setBuildCapabilities] = useState<
    BuildCapabilityId[]
  >([]);

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
    // A clarification belongs to the prompt it was asked about.
    setClarification(null);
  }, [description]);

  useEffect(() => {
    if (!detectIncomeIntent(description)) return;
    setBuildCapabilities((previous) => suggestCapabilitiesForIncome(previous));
  }, [description]);

  const createProjectMutation = useMutation({
    mutationFn: (productType?: ProductType) =>
      trpc.projects.create.mutate({
        title: description.slice(0, 60) || "Untitled App",
        description,
        productType,
        hcaptchaToken: hcaptchaToken ?? undefined,
        locale,
        buildCapabilities:
          buildCapabilities.length > 0 ? buildCapabilities : undefined,
      }),
    onSuccess: (data) => {
      if (data.status === "clarification_required") {
        // Nothing was created or charged; ask the structured question.
        writePromptDraft(description);
        setClarification(data.clarification);
        return;
      }
      setClarification(null);
      clearPromptDraft();
      setIsBuilding(true);
      navigate(`/build/${data.id}`);
    },
    onError: async (error, productType) => {
      const message = error instanceof Error ? error.message : String(error);
      const code =
        (
          error as {
            data?: { code?: string };
            shape?: { data?: { code?: string } };
          }
        )?.data?.code ??
        (error as { shape?: { data?: { code?: string } } })?.shape?.data?.code;

      writePromptDraft(description);

      if (code === "UNAUTHORIZED" || /not authenticated/i.test(message)) {
        if (!retriedAuth.current) {
          retriedAuth.current = true;
          const refreshed = await refreshSession();
          if (refreshed) {
            createProjectMutation.mutate(productType);
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

  const startBuild = async (productType?: ProductType) => {
    setFormError(null);

    if (!description.trim() || overLimit) return;

    writePromptDraft(description);
    const session = await ensureFreshSession();
    if (!session && !getAccessToken()) {
      navigate(loginPathWithReturn("/"));
      return;
    }

    createProjectMutation.mutate(productType);
  };

  const handleStartBuild = async (event: React.FormEvent) => {
    event.preventDefault();
    await startBuild();
  };

  const generateDisabled =
    !description.trim() ||
    createProjectMutation.isPending ||
    overLimit ||
    isBuilding;

  return (
    <div className="min-h-screen bg-forge-bg bg-forge-mesh">
      <div className="max-w-5xl mx-auto px-4 py-16 sm:py-20">
        <div className="text-center mb-14" data-testid="home-hero">
          <img
            src="/branding/logo-mark.png"
            alt="AppForge"
            width={520}
            height={520}
            className="mx-auto mb-6 h-64 w-64 sm:h-80 sm:w-80 md:h-96 md:w-96 lg:h-[28rem] lg:w-[28rem] object-contain drop-shadow-[0_24px_60px_rgba(184,134,11,0.28)]"
            data-testid="home-hero-logo"
          />
          <div className="flex justify-center mb-6">
            <span className="forge-badge" data-testid="hero-brand-badge">
              <span className="dot" /> A TrillionAI Tech Product
            </span>
          </div>
          <h1
            className="forge-metal-wordmark font-display text-7xl sm:text-8xl md:text-9xl lg:text-[10rem] font-bold tracking-[0.01em] leading-[0.95] mb-5"
            data-testid="home-hero-title"
          >
            AppForge
          </h1>
          <p className="text-lg sm:text-xl text-forge-text-muted max-w-2xl mx-auto">
            {t("home.tagline")}
          </p>
        </div>

        {tierStatus && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 mb-8 max-w-2xl mx-auto text-center">
            <p className="text-slate-700 dark:text-slate-300 font-semibold">
              {tierStatus.unlimited
                ? "Owner account · Unlimited lifetime access"
                : tierStatus.tier === "free"
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
            {!tierStatus.unlimited && tierStatus.tier === "free" && (
              <a
                href="/pricing"
                className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block"
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

        <div
          className="bg-forge-surface border border-forge-border rounded-[var(--forge-radius)] shadow-[var(--forge-shadow-soft)] p-6 sm:p-8 max-w-2xl mx-auto forge-noise"
          data-testid="hero-prompt-card"
        >
          <form onSubmit={handleStartBuild} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-forge-text-primary mb-3">
                {t("home.promptLabel")}
              </label>
              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value.slice(0, PROMPT_MAX_CHARS))
                }
                maxLength={PROMPT_MAX_CHARS}
                placeholder={t("home.promptPlaceholder")}
                data-testid="hero-app-idea-textarea"
                className="w-full h-32 px-4 py-3 bg-forge-bg border border-forge-border rounded-2xl text-forge-text-primary placeholder:text-forge-text-muted focus:outline-none focus:ring-2 focus:ring-[color:var(--forge-focus)] resize-none transition-[box-shadow,border-color]"
              />
              <p className="text-xs mt-2 text-slate-500 dark:text-slate-400">
                {t("home.charCount", { count: description.length })}
              </p>
            </div>

            <HcaptchaWidget onToken={setHcaptchaToken} />

            {clarification && (
              <div
                role="group"
                aria-labelledby="home-clarification-question"
                data-testid="home-clarification"
                className="rounded-2xl border border-forge-border bg-forge-bg p-4 space-y-3"
              >
                {clarification.questions.map((question) => (
                  <div key={question.id} className="space-y-2">
                    <p
                      id="home-clarification-question"
                      className="text-sm font-semibold text-forge-text-primary"
                    >
                      {question.question}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {question.choices.map((choice) => (
                        <button
                          key={choice.value}
                          type="button"
                          title={choice.description}
                          disabled={createProjectMutation.isPending}
                          data-testid={`home-clarification-choice-${choice.value}`}
                          onClick={() => {
                            setClarification(null);
                            void startBuild(choice.value);
                          }}
                          className="px-3 py-1.5 text-sm rounded-full border border-forge-border text-forge-text-primary hover:border-[color:var(--forge-focus)] disabled:opacity-50"
                        >
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {(formError || createProjectMutation.isError) && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {formError ||
                  String((createProjectMutation.error as Error)?.message || "")}
              </p>
            )}

            <button
              type="submit"
              disabled={generateDisabled}
              data-testid="home-generate-button"
              className="w-full forge-gold-btn font-bold py-3.5 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {outOfCredits
                ? t("home.pausedCta")
                : createProjectMutation.isPending
                  ? t("home.creating")
                  : t("home.generate")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

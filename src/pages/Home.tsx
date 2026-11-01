import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { BuildPromptComposer } from "../components/BuildPromptComposer.js";
import { CreditsPauseBanner } from "../components/CreditsPauseBanner.js";
import { HcaptchaWidget } from "../components/HcaptchaWidget.js";
import { LogoLockup } from "../components/brand/LogoMark.js";
import { useLocale } from "../i18n/LocaleContext.js";
import {
  ensureFreshSession,
  getAccessToken,
  loginPathWithReturn,
  refreshSession,
} from "../lib/auth.js";
import type { BuildCapabilityId } from "../lib/buildCapabilities.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { PROMPT_MAX_CHARS } from "../lib/prompt.js";
import {
  clearPromptDraft,
  readPromptDraft,
  writePromptDraft,
} from "../lib/promptDraft.js";
import type {
  ClarificationRequest,
  ProductType,
} from "../lib/productContract.js";
import {
  detectIncomeIntent,
  suggestCapabilitiesForIncome,
} from "../lib/revenueReadiness.js";
import { trpc } from "../utils/trpc.js";

const HOME_SUGGESTIONS = [
  "Build a booking app for my business",
  "Create a customer portal with subscriptions",
  "Make a mobile app and web dashboard",
] as const;

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
    queryKey: ["projects", "tierStatus", user?.id ?? null],
    queryFn: () => trpc.projects.tierStatus.query(),
    enabled: !!user,
  });

  useEffect(() => {
    writePromptDraft(description);
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

  const ownerUnlimited = user?.isOwner === true;
  const unlimited = ownerUnlimited || !!tierStatus?.unlimited;
  const creditBalance = tierStatus?.credits ?? 0;
  const outOfCredits =
    !!user &&
    tierStatus !== undefined &&
    !unlimited &&
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

  const submitLabel = outOfCredits
    ? t("home.pausedCta")
    : createProjectMutation.isPending
      ? t("home.creating")
      : t("home.generate");

  return (
    <div className="min-h-screen bg-forge-bg bg-forge-mesh">
      <div className="forge-container py-10 sm:py-14 lg:py-18">
        <div
          className="mx-auto mb-9 max-w-4xl text-center"
          data-testid="home-hero"
        >
          <div className="mb-6 flex justify-center" data-testid="home-hero-logo">
            <LogoLockup size="lg" />
          </div>
          <span className="forge-badge mb-5 inline-flex" data-testid="hero-brand-badge">
            <span className="dot" /> BUILD WORKSPACE
          </span>
          <h1
            className="forge-h1 mx-auto max-w-3xl"
            data-testid="home-hero-title"
          >
            What do you want AppForge to build?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-forge-text-muted sm:text-lg">
            Describe it in normal language or use the microphone. AppForge will work
            out the technical structure through the existing production pipeline.
          </p>
        </div>

        <div className="mx-auto mb-5 flex max-w-3xl flex-wrap items-center justify-center gap-3 text-xs text-forge-text-muted">
          {(tierStatus || ownerUnlimited) && (
            <span className="rounded-full border border-forge-border bg-forge-surface px-3 py-2">
              {unlimited
                ? "Owner · Unlimited lifetime access"
                : tierStatus?.tier === "free"
                  ? t("home.planFree", {
                      remaining: tierStatus.remaining ?? 0,
                      credits: tierStatus.credits ?? 0,
                    })
                  : tierStatus?.tier === "starter"
                    ? t("home.planStarter", {
                        remaining: tierStatus.remaining ?? 0,
                        credits: tierStatus.credits ?? 0,
                      })
                    : tierStatus?.tier === "builder"
                      ? t("home.planBuilder", {
                          remaining: tierStatus.remaining ?? 0,
                          credits: tierStatus.credits ?? 0,
                        })
                      : tierStatus?.tier === "studio"
                        ? t("home.planStudio", {
                            credits: tierStatus.credits ?? 0,
                          })
                        : t("home.planEnterprise")}
            </span>
          )}
          {!unlimited && tierStatus?.tier === "free" && (
            <a
              href="/pricing"
              className="rounded-full border border-forge-border bg-forge-surface px-3 py-2 font-semibold text-forge-text-primary hover:border-forge-gold/50"
            >
              {t("home.upgradeMore")}
            </a>
          )}
        </div>

        {outOfCredits && (
          <div className="mx-auto mb-6 max-w-3xl">
            <CreditsPauseBanner
              credits={creditBalance}
              cost={BUILD_CREDIT_COST}
              action={t("credits.actionStartBuild")}
            />
          </div>
        )}

        <div className="mx-auto max-w-3xl" data-testid="hero-prompt-card">
          <BuildPromptComposer
            value={description}
            onChange={(value) =>
              setDescription(value.slice(0, PROMPT_MAX_CHARS))
            }
            onSubmit={handleStartBuild}
            submitLabel={submitLabel}
            placeholder={t("home.promptPlaceholder")}
            suggestions={HOME_SUGGESTIONS}
            disabled={generateDisabled && !createProjectMutation.isPending}
            busy={createProjectMutation.isPending || isBuilding}
            maxLength={PROMPT_MAX_CHARS}
            label={t("home.promptLabel")}
            textareaTestId="hero-app-idea-textarea"
            submitTestId="home-generate-button"
            helperText={
              overLimit
                ? t("home.overLimit")
                : `${description.length.toLocaleString()} / ${PROMPT_MAX_CHARS.toLocaleString()} characters · your prompt is saved automatically`
            }
          >
            {!ownerUnlimited && <HcaptchaWidget onToken={setHcaptchaToken} />}

            {clarification && (
              <div
                role="group"
                aria-labelledby="home-clarification-question"
                data-testid="home-clarification"
                className="space-y-3 rounded-2xl border border-forge-border bg-forge-bg p-4"
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
                          className="rounded-full border border-forge-border px-3 py-1.5 text-sm text-forge-text-primary hover:border-forge-gold/60 disabled:opacity-50"
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
              <p className="text-sm text-amber-700 dark:text-amber-300" role="alert">
                {formError ||
                  String((createProjectMutation.error as Error)?.message || "")}
              </p>
            )}
          </BuildPromptComposer>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
          {[
            ["1", "Describe", "Tell AppForge what you want."],
            ["2", "Watch", "Open the real live build workspace."],
            ["3", "Refine & ship", "Change it, export it, or deploy it."],
          ].map(([number, title, body]) => (
            <div
              key={number}
              className="rounded-2xl border border-forge-border bg-forge-surface/75 p-4"
            >
              <span className="text-xs font-bold text-forge-gold">{number}</span>
              <p className="mt-2 text-sm font-semibold text-forge-text-primary">
                {title}
              </p>
              <p className="mt-1 text-xs leading-5 text-forge-text-muted">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { trpc } from "../utils/trpc.js";
import { getAccessToken, signOut } from "../lib/auth.js";
import { CreditsPauseBanner } from "../components/CreditsPauseBanner.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { PROMPT_MAX_CHARS } from "../lib/prompt.js";
import {
  getValidationMode,
  validationModeLabel,
} from "../lib/validationMode.js";
import {
  getStackMeta,
  tierBadgeClass,
  tierLabel,
} from "../lib/stackMetadata.js";
import { HcaptchaWidget } from "../components/HcaptchaWidget.js";
import {
  clearPromptDraft,
  readPromptDraft,
  readPromptStack,
  writePromptDraft,
  writePromptStack,
} from "../lib/promptDraft.js";
import { useLocale } from "../i18n/LocaleContext.js";
import { CapabilityPicker } from "../components/CapabilityPicker.js";
import { BuildPurposeStatement } from "../components/BuildPurposeStatement.js";
import type { BuildCapabilityId } from "../lib/buildCapabilities.js";

const TECH_STACKS = [
  "react-node",
  "react-python",
  "vue-node",
  "svelte-node",
  "next-node",
  "angular-node",
  "vanilla-node",
  "react-django",
  "react-supabase",
  "remix-node",
  "astro-node",
  "phaser-html5",
  "three-js-3d",
  "babylon-js-3d",
  "unity-webgl",
  "godot-html5",
  "react-native-game",
  "flutter-game",
  "ai-agent-python",
  "ai-agent-node",
  "openai-tool",
  "langchain-tool",
  "crewai-agent",
  "autogen-agent",
  "electron-react",
  "tauri-rust",
  "react-native-expo",
  "flutter-firebase",
  "capacitor-ionic",
  "chrome-extension",
  "vscode-extension",
  "discord-bot",
  "telegram-bot",
  "slack-bot",
  "browser-automation",
  "web-scraper",
  "data-visualization",
  "api-service",
  "serverless-aws",
  "serverless-vercel",
] as const;

type TechStack = (typeof TECH_STACKS)[number];

function isTechStack(value: string): value is TechStack {
  return (TECH_STACKS as readonly string[]).includes(value);
}

export function Home() {
  const [description, setDescription] = useState(() => readPromptDraft());
  const [techStack, setTechStack] = useState<TechStack>("react-node");
  const [isBuilding, setIsBuilding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null);
  const [buildCapabilities, setBuildCapabilities] = useState<
    BuildCapabilityId[]
  >([]);

  const validationMode = getValidationMode(techStack);
  const stackMeta = getStackMeta(techStack);

  const navigate = useNavigate();
  const { t, locale } = useLocale();
  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
  });
  const { data: tierStatus } = useQuery({
    queryKey: ["projects", "tierStatus"],
    queryFn: () => trpc.projects.tierStatus.query(),
    enabled: !!user,
  });

  useEffect(() => {
    const saved = readPromptStack();
    if (saved && isTechStack(saved)) setTechStack(saved);
  }, []);

  useEffect(() => {
    writePromptDraft(description);
  }, [description]);

  useEffect(() => {
    writePromptStack(techStack);
  }, [techStack]);

  const createProjectMutation = useMutation({
    mutationFn: () =>
      trpc.projects.create.mutate({
        title: description.slice(0, 60) || "Untitled App",
        description,
        techStack,
        hcaptchaToken: hcaptchaToken ?? undefined,
        locale,
        buildCapabilities:
          buildCapabilities.length > 0 ? buildCapabilities : undefined,
      }),
    onSuccess: (data) => {
      clearPromptDraft();
      setIsBuilding(true);
      navigate(`/build/${data.id}`);
    },
    onError: (err) => {
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
        signOut();
        setFormError(t("home.needAccount"));
        navigate("/signup?next=/");
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

  const handleStartBuild = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!description.trim() || overLimit) return;
    writePromptDraft(description);
    writePromptStack(techStack);
    const token = getAccessToken();
    if (!token) {
      navigate("/signup?next=/");
      return;
    }
    createProjectMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <img
            src="/appforge-logo.png"
            alt="AppForge"
            width={192}
            height={192}
            className="mx-auto mb-6 h-24 w-24 sm:h-32 sm:w-32 md:h-40 md:w-40 lg:h-48 lg:w-48 rounded-2xl object-contain"
          />
          <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-4">
            AppForge
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            {t("home.tagline")}
          </p>
        </div>

        {tierStatus && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 mb-8 max-w-2xl mx-auto text-center">
            <p className="text-slate-700 dark:text-slate-300 font-semibold">
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

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-2xl mx-auto">
          <form onSubmit={handleStartBuild} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                {t("home.promptLabel")}
              </label>
              <textarea
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value.slice(0, PROMPT_MAX_CHARS))
                }
                maxLength={PROMPT_MAX_CHARS}
                placeholder={t("home.promptPlaceholder")}
                className="w-full h-32 px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500 resize-none"
              />
              <p
                className={`text-xs mt-2 ${overLimit ? "text-amber-700 dark:text-amber-300 font-semibold" : "text-slate-500 dark:text-slate-400"}`}
              >
                {t("home.charCount", { count: description.length })}
              </p>
              {overLimit && (
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {t("home.overLimit")}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                {t("home.techStack")}
              </label>
              <select
                value={techStack}
                onChange={(e) => {
                  if (isTechStack(e.target.value)) setTechStack(e.target.value);
                }}
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500"
              >
                <optgroup label={t("home.groupWeb")}>
                  <option value="react-node">
                    React + Node.js + PostgreSQL
                  </option>
                  <option value="react-python">React + Python (FastAPI)</option>
                  <option value="vue-node">Vue 3 + Node.js</option>
                  <option value="svelte-node">SvelteKit + Node.js</option>
                  <option value="next-node">Next.js 14 + tRPC</option>
                  <option value="angular-node">Angular 17 + Node.js</option>
                  <option value="vanilla-node">Vanilla JS + Express</option>
                  <option value="react-django">React + Django</option>
                  <option value="react-supabase">React + Supabase</option>
                  <option value="remix-node">Remix + Node.js</option>
                  <option value="astro-node">Astro Islands + React</option>
                </optgroup>
                <optgroup label={t("home.groupGames")}>
                  <option value="phaser-html5">Phaser 3 HTML5 Game</option>
                  <option value="three-js-3d">Three.js 3D App / Game</option>
                  <option value="babylon-js-3d">Babylon.js 3D Engine</option>
                  <option value="unity-webgl">Unity WebGL Export</option>
                  <option value="godot-html5">Godot 4 HTML5 Export</option>
                  <option value="react-native-game">React Native Game</option>
                  <option value="flutter-game">Flutter + Flame Game</option>
                </optgroup>
                <optgroup label={t("home.groupAI")}>
                  <option value="ai-agent-python">
                    Python AI Agent (OpenAI/Claude)
                  </option>
                  <option value="ai-agent-node">
                    Node.js AI Agent (Function Calling)
                  </option>
                  <option value="openai-tool">
                    OpenAI GPT / Assistants Tool
                  </option>
                  <option value="langchain-tool">
                    LangChain / LangGraph Agent
                  </option>
                  <option value="crewai-agent">CrewAI Multi-Agent Crew</option>
                  <option value="autogen-agent">AutoGen Agent Swarm</option>
                </optgroup>
                <optgroup label={t("home.groupDesktop")}>
                  <option value="electron-react">
                    Electron + React Desktop
                  </option>
                  <option value="tauri-rust">Tauri (Rust) + React/Vue</option>
                  <option value="react-native-expo">React Native + Expo</option>
                  <option value="flutter-firebase">Flutter + Firebase</option>
                  <option value="capacitor-ionic">Ionic + Capacitor</option>
                </optgroup>
                <optgroup label={t("home.groupExt")}>
                  <option value="chrome-extension">
                    Chrome Extension (MV3)
                  </option>
                  <option value="vscode-extension">VS Code Extension</option>
                  <option value="discord-bot">Discord.js Bot</option>
                  <option value="telegram-bot">Telegram Bot</option>
                  <option value="slack-bot">Slack Bolt.js App</option>
                  <option value="browser-automation">
                    Playwright / Puppeteer
                  </option>
                  <option value="web-scraper">Web Scraper (Python/Node)</option>
                </optgroup>
                <optgroup label={t("home.groupApi")}>
                  <option value="data-visualization">
                    D3.js + React Visualization
                  </option>
                  <option value="api-service">
                    Standalone REST / GraphQL API
                  </option>
                  <option value="serverless-aws">
                    AWS Lambda + API Gateway
                  </option>
                  <option value="serverless-vercel">
                    Vercel Serverless / Edge
                  </option>
                </optgroup>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {t("home.techHint")} · {validationModeLabel(validationMode)}
              </p>
              <p className="text-xs mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full font-medium ${tierBadgeClass(stackMeta.tier)}`}
                >
                  {tierLabel(stackMeta.tier)}
                </span>
                {stackMeta.dockerCapable && (
                  <span className="text-slate-500 dark:text-slate-400">
                    Docker validation when available
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stackMeta.description}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Each build reserves {BUILD_CREDIT_COST} credits when it starts
                (charged once, not per agent).
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Descriptions are screened by automated moderation (regex). AI
                output is English-only.
              </p>
            </div>

            <CapabilityPicker
              selected={buildCapabilities}
              onChange={setBuildCapabilities}
              disabled={createProjectMutation.isPending || isBuilding}
            />

            <BuildPurposeStatement compact showBoundaries={false} />

            <HcaptchaWidget onToken={setHcaptchaToken} />

            {(formError || createProjectMutation.isError) && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {formError ||
                  String((createProjectMutation.error as Error)?.message || "")}
              </p>
            )}
            <button
              type="submit"
              disabled={
                !description.trim() ||
                createProjectMutation.isPending ||
                overLimit
              }
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {outOfCredits
                ? t("home.pausedCta")
                : createProjectMutation.isPending
                  ? t("home.creating")
                  : t("home.generate")}
            </button>
          </form>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-16">
          <FeatureCard
            icon="📱"
            title={t("home.catApps")}
            description={t("home.catAppsDesc")}
          />
          <FeatureCard
            icon="🎮"
            title={t("home.catGames")}
            description={t("home.catGamesDesc")}
          />
          <FeatureCard
            icon="🤖"
            title={t("home.catAgents")}
            description={t("home.catAgentsDesc")}
          />
          <FeatureCard
            icon="🛠️"
            title={t("home.catTools")}
            description={t("home.catToolsDesc")}
          />
          <FeatureCard
            icon="💻"
            title={t("home.catSoftware")}
            description={t("home.catSoftwareDesc")}
          />
          <FeatureCard
            icon="🌐"
            title={t("home.catWebsites")}
            description={t("home.catWebsitesDesc")}
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className="text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}

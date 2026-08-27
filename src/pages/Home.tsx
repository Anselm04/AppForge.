import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { trpc } from "../utils/trpc.js";
import { getAccessToken, signOut } from "../lib/auth.js";
import { CreditsPauseBanner } from "../components/CreditsPauseBanner.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { PROMPT_MAX_CHARS } from "../lib/prompt.js";
import { clearPromptDraft, readPromptDraft, readPromptStack, writePromptDraft, writePromptStack } from "../lib/promptDraft.js";
import { useLocale } from "../i18n/LocaleContext.js";

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

  const navigate = useNavigate();
  const { t } = useLocale();
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
      }),
    onSuccess: (data) => {
      clearPromptDraft();
      setIsBuilding(true);
      navigate(`/build/${data.id}`);
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { data?: { code?: string }; shape?: { data?: { code?: string } } })?.data?.code
        ?? (err as { shape?: { data?: { code?: string } } })?.shape?.data?.code;
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
  const outOfCredits = !!user && tierStatus !== undefined && !tierStatus.unlimited && creditBalance < BUILD_CREDIT_COST;

  const overLimit = description.length > PROMPT_MAX_CHARS;

  const handleStartBuild = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!description.trim() || overLimit) return;
    writePromptDraft(description);
    writePromptStack(techStack);
    createProjectMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-4">AppForge</h1>
          <p className="text-xl text-slate-600 dark:text-slate-400">{t("home.tagline")}</p>
        </div>
        {outOfCredits && (
          <div className="mb-8">
            <CreditsPauseBanner credits={creditBalance} cost={BUILD_CREDIT_COST} action={t("credits.actionStartBuild")} />
          </div>
        )}
        <form onSubmit={handleStartBuild} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("home.promptLabel")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("home.promptPlaceholder")}
              className="w-full h-40 px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
            <p className="text-xs text-slate-500 mt-1">{t("home.charCount", { count: description.length })}</p>
            {overLimit && <p className="text-xs text-red-500 mt-1">{t("home.overLimit")}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t("home.techStack")}</label>
            <select
              value={techStack}
              onChange={(e) => {
                  if (isTechStack(e.target.value)) setTechStack(e.target.value);
                }}
              className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              {TECH_STACKS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">{t("home.techHint")}</p>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <button
            type="submit"
            disabled={!description.trim() || overLimit || createProjectMutation.isPending || outOfCredits}
            className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold"
          >
            {createProjectMutation.isPending || isBuilding ? t("home.creating") : outOfCredits ? t("home.pausedCta") : t("home.generate")}
          </button>
        </form>
      </div>
    </div>
  );
}

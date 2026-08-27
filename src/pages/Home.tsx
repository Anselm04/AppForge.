import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { trpc } from "../utils/trpc.js";
import { useSession } from "../lib/auth.js";
import { CreditsPauseBanner } from "../components/CreditsPauseBanner.js";
import { BUILD_CREDIT_COST } from "../lib/credits.js";
import { useLocale } from "../i18n/LocaleContext.js";

export function Home() {
  const [description, setDescription] = useState("");
  const [techStack, setTechStack] = useState("react-node");
  const [isBuilding, setIsBuilding] = useState(false);

  const navigate = useNavigate();
  const { t } = useLocale();
  const session = useSession();
  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
  });
  const isAuthed = !!user || !!session;

  const { data: tierStatus } = useQuery({
    queryKey: ["projects", "tierStatus"],
    queryFn: () => trpc.projects.tierStatus.query(),
    enabled: !!user,
  });

  const createProjectMutation = useMutation({
    mutationFn: () =>
      trpc.projects.create.mutate({
        title: description.slice(0, 60) || "Untitled App",
        description,
        techStack,
      }),
    onSuccess: (data) => {
      setIsBuilding(true);
      window.location.href = `/build/${data.id}`;
    },
  });

  const creditBalance = tierStatus?.credits ?? 0;
  const outOfCredits = !!user && tierStatus !== undefined && creditBalance < BUILD_CREDIT_COST;

  const handleStartBuild = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthed) {
      navigate("/signup?next=/");
      return;
    }
    if (outOfCredits) return;
    if (description.trim()) {
      createProjectMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
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
                ? t("home.planFree", { remaining: tierStatus.remaining ?? 0, credits: tierStatus.credits ?? 0 })
                : tierStatus.tier === "starter"
                ? t("home.planStarter", { remaining: tierStatus.remaining ?? 0, credits: tierStatus.credits ?? 0 })
                : tierStatus.tier === "builder"
                ? t("home.planBuilder", { remaining: tierStatus.remaining ?? 0, credits: tierStatus.credits ?? 0 })
                : tierStatus.tier === "studio"
                ? t("home.planStudio", { credits: tierStatus.credits ?? 0 })
                : t("home.planEnterprise")}
            </p>
            {tierStatus.tier === "free" && (
              <a href="/pricing" className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block">
                {t("home.upgradeMore")}
              </a>
            )}
          </div>
        )}

        {outOfCredits && (
          <div className="max-w-2xl mx-auto mb-8">
            <CreditsPauseBanner credits={creditBalance} cost={BUILD_CREDIT_COST} action={t("credits.actionStartBuild")} />
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
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("home.promptPlaceholder")}
                className="w-full h-32 px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500 resize-none"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {t("home.charCount", { count: description.length })}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                {t("home.techStack")}
              </label>
              <select
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500"
              >
                <optgroup label={t("home.groupWeb")}>
                  <option value="react-node">React + Node.js + PostgreSQL</option>
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
                  <option value="ai-agent-python">Python AI Agent (OpenAI/Claude)</option>
                  <option value="ai-agent-node">Node.js AI Agent (Function Calling)</option>
                  <option value="openai-tool">OpenAI GPT / Assistants Tool</option>
                  <option value="langchain-tool">LangChain / LangGraph Agent</option>
                  <option value="crewai-agent">CrewAI Multi-Agent Crew</option>
                  <option value="autogen-agent">AutoGen Agent Swarm</option>
                </optgroup>
                <optgroup label={t("home.groupDesktop")}>
                  <option value="electron-react">Electron + React Desktop</option>
                  <option value="tauri-rust">Tauri (Rust) + React/Vue</option>
                  <option value="react-native-expo">React Native + Expo</option>
                  <option value="flutter-firebase">Flutter + Firebase</option>
                  <option value="capacitor-ionic">Ionic + Capacitor</option>
                </optgroup>
                <optgroup label={t("home.groupExt")}>
                  <option value="chrome-extension">Chrome Extension (MV3)</option>
                  <option value="vscode-extension">VS Code Extension</option>
                  <option value="discord-bot">Discord.js Bot</option>
                  <option value="telegram-bot">Telegram Bot</option>
                  <option value="slack-bot">Slack Bolt.js App</option>
                  <option value="browser-automation">Playwright / Puppeteer</option>
                  <option value="web-scraper">Web Scraper (Python/Node)</option>
                </optgroup>
                <optgroup label={t("home.groupApi")}>
                  <option value="data-visualization">D3.js + React Visualization</option>
                  <option value="api-service">Standalone REST / GraphQL API</option>
                  <option value="serverless-aws">AWS Lambda + API Gateway</option>
                  <option value="serverless-vercel">Vercel Serverless / Edge</option>
                </optgroup>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {t("home.techHint")}
              </p>
            </div>

            {createProjectMutation.isError && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {String((createProjectMutation.error as Error)?.message || "")}
              </p>
            )}
            <button
              type="submit"
              disabled={!description.trim() || createProjectMutation.isPending || outOfCredits}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <FeatureCard icon="⚡" title={t("home.fastTitle")} description={t("home.fastDesc")} />
          <FeatureCard icon="🤖" title={t("home.aiTitle")} description={t("home.aiDesc")} />
          <FeatureCard icon="🚀" title={t("home.prodTitle")} description={t("home.prodDesc")} />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}

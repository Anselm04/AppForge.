import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

export function Home() {
  const [description, setDescription] = useState("");
  const [techStack, setTechStack] = useState("react-node");
  const [isBuilding, setIsBuilding] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => trpc.auth.me.query(),
  });

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
      // Redirect to build page
      window.location.href = `/build/${data.id}`;
    },
  });

  const handleStartBuild = (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim()) {
      createProjectMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-6xl mx-auto px-4 py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-4">
            AppForge
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Build full-stack web apps with AI. Describe your idea, get production code.
          </p>
        </div>

        {/* Credit & Tier Status */}
        {tierStatus && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-4 mb-8 max-w-2xl mx-auto text-center">
            <p className="text-slate-700 dark:text-slate-300 font-semibold">
              {tierStatus.tier === "free"
                ? `Free plan: ${tierStatus.remaining ?? 0} builds & ${tierStatus.credits ?? 0} credits remaining`
                : tierStatus.tier === "starter"
                ? `Starter plan: ${tierStatus.remaining ?? 0} builds & ${tierStatus.credits ?? 0} credits`
                : tierStatus.tier === "builder"
                ? `Builder plan: ${tierStatus.remaining ?? 0} builds & ${tierStatus.credits ?? 0} credits`
                : tierStatus.tier === "studio"
                ? `Studio plan: unlimited builds, ${tierStatus.credits ?? 0} credits`
                : `Enterprise plan: unlimited builds & credits`}
            </p>
            {tierStatus.tier === "free" && (
              <a href="/pricing" className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block">
                Upgrade for more builds and credits
              </a>
            )}
          </div>
        )}

        {/* Build Form */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-2xl mx-auto">
          <form onSubmit={handleStartBuild} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                What app do you want to build?
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., A todo list with dark mode, a booking app for my salon, a sales dashboard..."
                className="w-full h-32 px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500 resize-none"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                {description.length} / 2000 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                Tech Stack
              </label>
              <select
                value={techStack}
                onChange={(e) => setTechStack(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:border-blue-500"
              >
                <optgroup label="Web Apps">
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
                <optgroup label="Games & 3D">
                  <option value="phaser-html5">Phaser 3 HTML5 Game</option>
                  <option value="three-js-3d">Three.js 3D App / Game</option>
                  <option value="babylon-js-3d">Babylon.js 3D Engine</option>
                  <option value="unity-webgl">Unity WebGL Export</option>
                  <option value="godot-html5">Godot 4 HTML5 Export</option>
                  <option value="react-native-game">React Native Game</option>
                  <option value="flutter-game">Flutter + Flame Game</option>
                </optgroup>
                <optgroup label="AI Agents & Tools">
                  <option value="ai-agent-python">Python AI Agent (OpenAI/Claude)</option>
                  <option value="ai-agent-node">Node.js AI Agent (Function Calling)</option>
                  <option value="openai-tool">OpenAI GPT / Assistants Tool</option>
                  <option value="langchain-tool">LangChain / LangGraph Agent</option>
                  <option value="crewai-agent">CrewAI Multi-Agent Crew</option>
                  <option value="autogen-agent">AutoGen Agent Swarm</option>
                </optgroup>
                <optgroup label="Desktop & Mobile">
                  <option value="electron-react">Electron + React Desktop</option>
                  <option value="tauri-rust">Tauri (Rust) + React/Vue</option>
                  <option value="react-native-expo">React Native + Expo</option>
                  <option value="flutter-firebase">Flutter + Firebase</option>
                  <option value="capacitor-ionic">Ionic + Capacitor</option>
                </optgroup>
                <optgroup label="Extensions, Bots & Automation">
                  <option value="chrome-extension">Chrome Extension (MV3)</option>
                  <option value="vscode-extension">VS Code Extension</option>
                  <option value="discord-bot">Discord.js Bot</option>
                  <option value="telegram-bot">Telegram Bot</option>
                  <option value="slack-bot">Slack Bolt.js App</option>
                  <option value="browser-automation">Playwright / Puppeteer</option>
                  <option value="web-scraper">Web Scraper (Python/Node)</option>
                </optgroup>
                <optgroup label="APIs & Data">
                  <option value="data-visualization">D3.js + React Visualization</option>
                  <option value="api-service">Standalone REST / GraphQL API</option>
                  <option value="serverless-aws">AWS Lambda + API Gateway</option>
                  <option value="serverless-vercel">Vercel Serverless / Edge</option>
                </optgroup>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                AppForge generates code for your chosen stack, compiles it, and attempts to auto-fix errors.
              </p>
            </div>

            <button
              type="submit"
              disabled={!description.trim() || createProjectMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {createProjectMutation.isPending ? "Creating..." : "Generate App"}
            </button>
          </form>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
          <FeatureCard icon="⚡" title="Fast" description="Generate full-stack apps in minutes, not days." />
          <FeatureCard icon="🤖" title="AI-Powered" description="Multi-agent pipeline plans, codes, and reviews your app." />
          <FeatureCard icon="🚀" title="Production-Ready" description="Export to GitHub and deploy to Vercel with one click." />
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

import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "./utils/trpc";

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
            🚀 AppForge
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300">
            Build full-stack web apps with AI. Describe your idea, get production code.
          </p>
        </div>

        {/* Tier Status */}
        {tierStatus && !tierStatus.isPro && (
          <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-8 text-center">
            <p className="text-amber-800 dark:text-amber-300">
              Free tier: {tierStatus.remaining} builds remaining this month
            </p>
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
                <option value="react-node">React + Node.js</option>
                <option value="vue-express">Vue + Express</option>
                <option value="nextjs-prisma">Next.js + Prisma</option>
              </select>
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
          <FeatureCard icon="🚀" title="Production-Ready" description="Export to GitHub with one click." />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: any) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 text-center">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}

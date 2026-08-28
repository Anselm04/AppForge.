import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { trpc } from "../utils/trpc.js";

type Goal = "traffic" | "leads" | "sales";

export function MarketingStudio() {
  const [product, setProduct] = useState("");
  const [goal, setGoal] = useState<Goal>("leads");
  const [projectId, setProjectId] = useState("");
  const [campaign, setCampaign] = useState<Record<string, unknown> | null>(
    null,
  );

  const generate = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateMarketing.mutate({
        product,
        goal,
        channels: ["landing", "email", "social", "seo", "ads"],
      }),
    onSuccess: (data) => setCampaign(data as Record<string, unknown>),
  });

  const attach = useMutation({
    mutationFn: (content: string) =>
      trpc.capabilities.attachStudioAsset.mutate({
        projectId: parseInt(projectId, 10),
        filename: "campaign.json",
        content,
        kind: "marketing",
      }),
  });

  const search = useMutation({
    mutationFn: (q: string) => trpc.capabilities.webSearch.mutate({ query: q }),
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link to="/studio" className="text-sm text-blue-600 dark:text-blue-400">
          ← Creative Studio
        </Link>
        <h1 className="text-3xl font-bold mt-4 mb-2">Marketing Studio</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          AI campaigns for traffic, leads, and sales — landing copy, email, ads,
          and SEO.
        </p>

        <textarea
          className="w-full h-32 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 mb-4"
          placeholder="Describe your product or app…"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        />

        <div className="flex flex-wrap gap-2 mb-4">
          {(["traffic", "leads", "sales"] as Goal[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGoal(g)}
              className={`px-4 py-2 rounded-lg text-sm capitalize ${
                goal === g
                  ? "bg-blue-600 text-white"
                  : "bg-slate-200 dark:bg-slate-800"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            disabled={product.length < 5 || generate.isPending}
            onClick={() => generate.mutate()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
          >
            {generate.isPending ? "Generating…" : "Generate campaign"}
          </button>
          <button
            type="button"
            disabled={!product || search.isPending}
            onClick={() =>
              search.mutate(`${product} market competitors pricing 2026`)
            }
            className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm"
          >
            {search.isPending ? "Searching…" : "Research market (web)"}
          </button>
        </div>

        {search.data && (
          <div className="mb-6 bg-white dark:bg-slate-800 rounded-lg p-4 text-sm border border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold mb-2">Web research</h3>
            {search.data.answer && (
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                {search.data.answer}
              </p>
            )}
            <ul className="list-disc list-inside text-slate-500 space-y-1">
              {search.data.results.slice(0, 4).map((r) => (
                <li key={r.url}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400"
                  >
                    {r.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {campaign && (
          <pre className="bg-slate-900 text-green-300 p-4 rounded-lg text-xs overflow-auto max-h-96 mb-6">
            {JSON.stringify(campaign, null, 2)}
          </pre>
        )}

        <div className="flex gap-2 items-end">
          <input
            placeholder="Project ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border rounded px-2 py-1 w-28 dark:bg-slate-800 dark:border-slate-700"
          />
          <button
            type="button"
            disabled={!projectId || !campaign || attach.isPending}
            onClick={() =>
              attach.mutate(JSON.stringify({ goal, ...campaign }, null, 2))
            }
            className="bg-slate-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Attach to project
          </button>
        </div>
      </div>
    </div>
  );
}

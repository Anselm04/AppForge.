import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { trpc } from "../utils/trpc.js";
import { buildOpportunityBuildPath } from "../lib/marketIntelligenceHandoff.js";
import { writePromptDraft } from "../lib/promptDraft.js";

export function OpportunityIntelligence() {
  const navigate = useNavigate();
  const [idea, setIdea] = useState("");
  const [audience, setAudience] = useState("");
  const [region, setRegion] = useState("");

  const analysis = useMutation({
    mutationFn: () =>
      trpc.marketIntelligence.analyze.mutate({
        idea,
        audience: audience.trim() || undefined,
        region: region.trim() || undefined,
      }),
  });

  const report = analysis.data;

  return (
    <div className="min-h-screen bg-forge-bg bg-forge-mesh py-12">
      <main className="mx-auto max-w-6xl px-4">
        <section className="mb-8">
          <span className="forge-badge">Opportunity Intelligence</span>
          <h1 className="mt-4 font-display text-4xl font-bold text-(--forge-heading)">
            Find evidence before you build
          </h1>
          <p className="mt-3 max-w-3xl text-forge-text-muted">
            AppForge researches live market evidence, competitor positioning, customer pain,
            monetization options, and marketing angles before handing a validated brief to the
            existing production builder.
          </p>
        </section>

        <section className="bg-forge-surface border border-forge-border rounded-(--forge-radius) shadow-(--forge-shadow-soft) p-6 mb-8">
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (idea.trim().length >= 10) analysis.mutate();
            }}
          >
            <label className="md:col-span-2">
              <span className="block text-sm font-semibold text-forge-text-primary mb-2">
                Product idea
              </span>
              <textarea
                value={idea}
                onChange={(event) => setIdea(event.target.value.slice(0, 1500))}
                placeholder="Example: An app that alerts diners when hard-to-book restaurant reservations become available"
                className="w-full min-h-32 bg-forge-bg border border-forge-border p-3 text-forge-text-primary"
                required
                minLength={10}
                maxLength={1500}
              />
            </label>
            <label>
              <span className="block text-sm font-semibold text-forge-text-primary mb-2">
                Target audience (optional)
              </span>
              <input
                value={audience}
                onChange={(event) => setAudience(event.target.value.slice(0, 500))}
                className="w-full bg-forge-bg border border-forge-border p-3 text-forge-text-primary"
                placeholder="Busy diners, tradespeople, creators..."
              />
            </label>
            <label>
              <span className="block text-sm font-semibold text-forge-text-primary mb-2">
                Region (optional)
              </span>
              <input
                value={region}
                onChange={(event) => setRegion(event.target.value.slice(0, 120))}
                className="w-full bg-forge-bg border border-forge-border p-3 text-forge-text-primary"
                placeholder="New Zealand, United States, global..."
              />
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="forge-btn-gold px-5 py-3"
                disabled={analysis.isPending || idea.trim().length < 10}
              >
                {analysis.isPending ? "Researching live evidence…" : "Analyze opportunity"}
              </button>
              <span className="text-xs text-forge-text-muted">
                Uses configured live search providers. No synthetic market metrics are shown.
              </span>
            </div>
          </form>
        </section>

        {analysis.error && (
          <div className="mb-8 border border-red-500/50 bg-red-500/10 p-4 text-red-200" role="alert">
            {analysis.error instanceof Error
              ? analysis.error.message
              : "Market intelligence is currently unavailable."}
          </div>
        )}

        {report && (
          <div className="space-y-8" data-testid="market-intelligence-report">
            <section className="grid gap-4 md:grid-cols-3">
              <div className="bg-forge-surface border border-forge-border p-6 md:col-span-1">
                <p className="text-sm uppercase tracking-wider text-forge-text-muted">Opportunity score</p>
                <p className="mt-2 font-display text-6xl font-bold text-(--forge-heading)">{report.score}</p>
                <p className="mt-2 font-semibold text-forge-text-primary">{report.recommendation}</p>
                <p className="text-sm text-forge-text-muted">Confidence: {report.confidence}</p>
              </div>
              <div className="bg-forge-surface border border-forge-border p-6 md:col-span-2">
                <h2 className="font-display text-2xl font-semibold text-(--forge-heading)">Market summary</h2>
                <p className="mt-3 text-forge-text-primary">{report.summary.text}</p>
                <h3 className="mt-5 font-semibold text-forge-text-primary">Positioning</h3>
                <p className="mt-2 text-forge-text-muted">{report.positioning.text}</p>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-5">
              {Object.entries(report.scores).map(([label, value]) => (
                <div key={label} className="bg-forge-surface border border-forge-border p-4">
                  <p className="text-xs uppercase tracking-wider text-forge-text-muted">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-(--forge-heading)">{Math.round(value)}</p>
                </div>
              ))}
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <ReportList title="Customer pain" items={report.customerPains} />
              <ReportList title="Feature gaps / differentiation" items={report.featureGaps} />
              <ReportList title="Marketing hooks" items={report.marketingHooks} />
              <ReportList title="Risks" items={report.risks} />
            </section>

            <section className="bg-forge-surface border border-forge-border p-6">
              <h2 className="font-display text-2xl font-semibold text-(--forge-heading)">Monetization</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {report.monetization.map((item, index) => (
                  <article key={`${item.model}-${index}`} className="border border-forge-border p-4">
                    <h3 className="font-semibold text-forge-text-primary">{item.model}</h3>
                    <p className="mt-2 text-forge-text-muted">{item.rationale}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="bg-forge-surface border border-forge-border p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-(--forge-heading)">Build brief</h2>
                  <p className="mt-2 max-w-4xl whitespace-pre-wrap text-forge-text-muted">{report.buildBrief}</p>
                </div>
                <button
                  type="button"
                  className="forge-btn-gold shrink-0 px-5 py-3"
                  onClick={() => {
                    writePromptDraft(report.buildBrief);
                    navigate(buildOpportunityBuildPath(report.buildBrief));
                  }}
                >
                  Build this opportunity
                </button>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <Readiness title="Web publishing" items={report.publishingReadiness.web} />
              <Readiness title="Apple App Store" items={report.publishingReadiness.apple} />
              <Readiness title="Google Play" items={report.publishingReadiness.googlePlay} />
            </section>

            <section className="bg-forge-surface border border-forge-border p-6">
              <h2 className="font-display text-2xl font-semibold text-(--forge-heading)">Evidence sources</h2>
              <div className="mt-4 space-y-3">
                {report.sources.map((source) => (
                  <article key={source.id} className="border-b border-forge-border pb-3 last:border-0">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-(--forge-heading) underline"
                    >
                      [{source.id}] {source.title}
                    </a>
                    <p className="mt-1 text-sm text-forge-text-muted">{source.snippet}</p>
                    <p className="mt-1 text-xs text-forge-text-muted">Provider: {source.source}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function ReportList({
  title,
  items,
}: {
  title: string;
  items: { text: string; evidence: number[] }[];
}) {
  return (
    <section className="bg-forge-surface border border-forge-border p-6">
      <h2 className="font-display text-xl font-semibold text-(--forge-heading)">{title}</h2>
      <ul className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={`${item.text}-${index}`} className="text-forge-text-primary">
            {item.text}
            {item.evidence.length > 0 && (
              <span className="ml-2 text-xs text-forge-text-muted">
                [{item.evidence.join(", ")}]
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Readiness({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="bg-forge-surface border border-forge-border p-6">
      <h2 className="font-display text-xl font-semibold text-(--forge-heading)">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm text-forge-text-muted">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </section>
  );
}

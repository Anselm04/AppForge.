import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { isProjectArtifactReady } from "../lib/buildStatus.js";

type ProjectSummary = {
  id: number;
  title: string | null;
  status: string | null;
  techStack?: string | null;
};

const LAUNCH_STEPS = [
  { name: "Review your product", detail: "Open your project, check its features and confirm the build is complete." },
  { name: "Choose where it runs", detail: "Compare hosting or app-store choices for the technology your product uses. Any external account and charge is your decision." },
  { name: "Prepare your accounts", detail: "Set up required domain, hosting, store or API accounts in your own name. Keep passwords and secret keys private." },
  { name: "Deploy and verify", detail: "Follow the deployment process available for your project, then verify the live address and essential features. A finished build is not automatically live." },
  { name: "Maintain your product", detail: "Plan backups, renewals, updates, security fixes and usage monitoring. Ask for help whenever you need it." },
] as const;

export function Aftercare() {
  const [expanded, setExpanded] = useState<number>(0);
  const projects = useQuery({
    queryKey: ["projects", "list"],
    queryFn: () => trpc.projects.list.query(),
    retry: false,
  });

  return (
    <main className="bg-forge-mesh min-h-screen">
      <div className="forge-container forge-section space-y-7">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold text-forge-cyan">APPFORGE AFTERCARE</p>
          <h1 className="forge-h1 mt-2">Your product. Your launch. We're here to help.</h1>
          <p className="forge-body mt-3">Find your build, understand the steps to launch and get help without signing up for another service.</p>
        </header>
        <GlassCard hover={false}>
          <h2 className="forge-h3 mb-3">Your products</h2>
          {projects.isLoading && <p role="status">Loading your projects…</p>}
          {projects.isError && <p role="alert">We couldn't load your projects. Try refreshing or contact support.</p>}
          {projects.data?.length === 0 && (
            <p className="text-forge-text-muted">No projects yet. <Link className="text-forge-cyan underline" to="/app/new">Create your first product</Link>.</p>
          )}
          <ul className="space-y-3">
            {projects.data?.map((project: ProjectSummary) => {
              const ready = isProjectArtifactReady(project.status);
              return (
                <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-forge-border p-3">
                  <div>
                    <h3 className="font-semibold">{project.title || `Project #${project.id}`}</h3>
                    <p className="text-sm text-forge-text-muted">
                      {ready ? "Build artifact available — deployment not verified here" : `Build status: ${project.status || "unknown"}`}
                    </p>
                  </div>
                  <Link className="forge-ghost-btn inline-flex h-11 items-center px-4 text-sm" to={`/build/${project.id}`}>Open project</Link>
                </li>
              );
            })}
          </ul>
        </GlassCard>
        <section aria-labelledby="launch-heading" className="space-y-3">
          <h2 id="launch-heading" className="forge-h2">How to get your product live</h2>
          <p className="text-sm text-forge-text-muted">These steps explain the process. They do not deploy anything or make purchases on your behalf.</p>
          {LAUNCH_STEPS.map((step, index) => (
            <GlassCard hover={false} key={step.name}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={expanded === index}
                aria-controls={`launch-step-${index}`}
                onClick={() => setExpanded(expanded === index ? -1 : index)}
              >
                <span className="font-semibold">{index + 1}. {step.name}</span>
                <span aria-hidden="true">{expanded === index ? "−" : "+"}</span>
              </button>
              {expanded === index && <p id={`launch-step-${index}`} className="mt-3 text-sm text-forge-text-muted">{step.detail}</p>}
            </GlassCard>
          ))}
        </section>
        <GlassCard hover={false}>
          <h2 className="forge-h3 mb-2">Before choosing a hosting or deployment service</h2>
          <p className="text-sm text-forge-text-muted mb-3">Ask the provider about setup charges, monthly costs, traffic limits, database/storage fees, backups and what happens if you cancel. App-store developer accounts and paid APIs can have separate charges.</p>
          <p className="text-sm font-semibold">No hosting plan or paid aftercare add-on is selected here.</p>
        </GlassCard>
        <GlassCard hover={false}>
          <h2 className="forge-h3 mb-2">Need help after the build?</h2>
          <p className="text-sm text-forge-text-muted mb-4">Our support centre lets signed-in customers open and track cases about builds, deployment, billing or account access. Please never send passwords or API keys.</p>
          <Link className="forge-btn inline-flex min-h-11 items-center px-5" to="/help">Open support centre</Link>
        </GlassCard>
      </div>
    </main>
  );
}

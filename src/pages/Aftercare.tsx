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
};

const LAUNCH_STEPS = [
  {
    name: "Review your product",
    detail: "Open your project and confirm the build is complete.",
  },
  {
    name: "Choose where it runs",
    detail:
      "Compare hosting and app-store options. External accounts and fees are your choice.",
  },
  {
    name: "Prepare your accounts",
    detail:
      "Set up your hosting, domain and other required accounts. Keep passwords and keys private.",
  },
  {
    name: "Deploy and verify",
    detail:
      "Follow your project's deployment instructions. Check the live address and main features.",
  },
  {
    name: "Maintain your product",
    detail:
      "Plan backups, renewals, security updates and usage monitoring. Ask for help when needed.",
  },
] as const;

export function Aftercare() {
  const [expanded, setExpanded] = useState(0);
  const projects = useQuery({
    queryKey: ["projects", "list"],
    queryFn: () => trpc.projects.list.query(),
    retry: false,
  });

  return (
    <main className="bg-forge-mesh min-h-screen">
      <div className="forge-container forge-section space-y-7">
        <header className="max-w-3xl">
          <p className="text-sm font-semibold text-forge-cyan">
            APPFORGE AFTERCARE
          </p>
          <h1 className="forge-h1 mt-2">
            Your product. Your launch. We're here to help.
          </h1>
          <p className="forge-body mt-3">
            Find your build, prepare to launch, and get help after delivery.
          </p>
        </header>

        <GlassCard hover={false}>
          <h2 className="forge-h3 mb-3">Your products</h2>
          {projects.isLoading && <p role="status">Loading your projects…</p>}
          {projects.isError && (
            <p role="alert">
              We couldn't load your projects. Try again or contact support.
            </p>
          )}
          {projects.data?.length === 0 && (
            <p className="text-forge-text-muted">
              No projects yet.{" "}
              <Link className="text-forge-cyan underline" to="/app/new">
                Create your first product
              </Link>
              .
            </p>
          )}
          <ul className="space-y-3">
            {projects.data?.map((project: ProjectSummary) => {
              const ready = isProjectArtifactReady(project.status);
              return (
                <li
                  key={project.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-forge-border p-3"
                >
                  <div>
                    <h3 className="font-semibold">
                      {project.title || `Project #${project.id}`}
                    </h3>
                    <p className="text-sm text-forge-text-muted">
                      {ready
                        ? "Build available — launch not verified here"
                        : `Build status: ${project.status || "unknown"}`}
                    </p>
                  </div>
                  <Link
                    className="forge-ghost-btn inline-flex h-11 items-center px-4 text-sm"
                    to={`/build/${project.id}`}
                  >
                    Open project
                  </Link>
                </li>
              );
            })}
          </ul>
        </GlassCard>

        <section aria-labelledby="launch-heading" className="space-y-3">
          <h2 id="launch-heading" className="forge-h2">
            How to get your product live
          </h2>
          <p className="text-sm text-forge-text-muted">
            These steps explain the process. Nothing is deployed or purchased
            from this page.
          </p>
          {LAUNCH_STEPS.map((step, index) => (
            <GlassCard hover={false} key={step.name}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                aria-expanded={expanded === index}
                aria-controls={`launch-step-${index}`}
                onClick={() => setExpanded(expanded === index ? -1 : index)}
              >
                <span className="font-semibold">
                  {index + 1}. {step.name}
                </span>
                <span aria-hidden="true">
                  {expanded === index ? "−" : "+"}
                </span>
              </button>
              {expanded === index && (
                <p
                  id={`launch-step-${index}`}
                  className="mt-3 text-sm text-forge-text-muted"
                >
                  {step.detail}
                </p>
              )}
            </GlassCard>
          ))}
        </section>

        <GlassCard hover={false}>
          <h2 className="forge-h3 mb-2">
            Check your costs before you launch
          </h2>
          <p className="text-sm text-forge-text-muted mb-3">
            Hosting, domains, app-store accounts, databases and paid APIs may
            charge separately. Compare their prices, limits and cancellation
            terms before agreeing.
          </p>
          <p className="text-sm font-semibold">
            No paid hosting or aftercare plan is selected here.
          </p>
        </GlassCard>

        <GlassCard hover={false}>
          <h2 className="forge-h3 mb-2">Need help after the build?</h2>
          <p className="text-sm text-forge-text-muted mb-4">
            Open and track support cases about your build, deployment, billing
            or account. Never share passwords or API keys.
          </p>
          <Link
            className="forge-ghost-btn inline-flex min-h-11 items-center px-5"
            to="/help"
          >
            Open support centre
          </Link>
        </GlassCard>
      </div>
    </main>
  );
}

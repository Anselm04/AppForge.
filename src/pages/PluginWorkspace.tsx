import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Button } from "../design-system/Button.js";
import { Badge } from "../design-system/Badge.js";
import { GlassCard } from "../design-system/GlassCard.js";
import { useSession } from "../lib/auth.js";
import { trpc } from "../utils/trpc.js";

type ArtifactKind = "document" | "pdf" | "spreadsheet" | "presentation";

type ProjectSummary = {
  id: number;
  title: string | null;
  status: string | null;
};

function stateTone(
  state: string,
): "success" | "cyan" | "gold" | "default" {
  if (state === "connected") return "success";
  if (state === "needs_attention") return "gold";
  if (state === "configuration_required") return "cyan";
  return "default";
}

function csvFromTextarea(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rows = lines.map((line) => line.split("\t"));
  return {
    headers: rows[0] ?? ["Value"],
    rows: rows.slice(1),
  };
}

function slidesFromTextarea(value: string) {
  return value
    .split(/\n\s*---\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const [first, ...rest] = block.split(/\r?\n/);
      return {
        title: first?.trim() || `Slide ${index + 1}`,
        body: rest.join("\n").trim(),
      };
    });
}

export function PluginWorkspace() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState<number | null>(null);
  const [researchTopic, setResearchTopic] = useState("");
  const [researchObjective, setResearchObjective] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [automationEvent, setAutomationEvent] = useState("project.updated");
  const [automationPayload, setAutomationPayload] = useState("{}");
  const [artifactKind, setArtifactKind] = useState<ArtifactKind>("document");
  const [artifactName, setArtifactName] = useState("project-report");
  const [artifactTitle, setArtifactTitle] = useState("Project Report");
  const [artifactBody, setArtifactBody] = useState("");
  const [result, setResult] = useState<string>("");

  useEffect(() => {
    if (!session) navigate("/login?next=/tools", { replace: true });
  }, [session, navigate]);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", "list", "tools"],
    queryFn: () => trpc.projects.list.query(),
    enabled: !!session,
    retry: false,
  });

  const { data: health, isFetching: healthRefreshing } = useQuery({
    queryKey: ["ecosystem", "integrations", "tools"],
    queryFn: () => trpc.ecosystem.integrations.query(),
    enabled: !!session,
    retry: false,
    staleTime: 30_000,
  });

  const completedProjects = useMemo(
    () =>
      (projects as ProjectSummary[]).filter(
        (project) => project.status === "completed",
      ),
    [projects],
  );

  useEffect(() => {
    if (projectId || completedProjects.length === 0) return;
    setProjectId(completedProjects[0].id);
  }, [completedProjects, projectId]);

  const research = useMutation({
    mutationFn: () =>
      trpc.deepResearch.run.mutate({
        topic: researchTopic,
        objective: researchObjective || undefined,
        maxSources: 12,
      }),
    onSuccess: (data) => setResult(JSON.stringify(data, null, 2)),
    onError: (error) => setResult(`Research failed: ${error.message}`),
  });

  const support = useMutation({
    mutationFn: () =>
      trpc.ecosystem.supportMessage.mutate({ message: supportMessage }),
    onSuccess: (data) => setResult(JSON.stringify(data, null, 2)),
    onError: (error) => setResult(`Support failed: ${error.message}`),
  });

  const automation = useMutation({
    mutationFn: () => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(automationPayload) as Record<string, unknown>;
      } catch {
        throw new Error("Automation payload must be valid JSON");
      }
      return trpc.ecosystem.runAutomation.mutate({
        event: automationEvent,
        payload,
      });
    },
    onSuccess: (data) => setResult(JSON.stringify(data, null, 2)),
    onError: (error) => setResult(`Automation failed: ${error.message}`),
  });

  const createArtifact = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("Choose a completed project first");

      if (artifactKind === "document") {
        return trpc.artifacts.createDocument.mutate({
          projectId,
          filename: artifactName,
          title: artifactTitle,
          content: artifactBody,
          format: "markdown",
        });
      }
      if (artifactKind === "pdf") {
        return trpc.artifacts.createPdf.mutate({
          projectId,
          filename: artifactName,
          title: artifactTitle,
          lines: artifactBody.split(/\r?\n/).filter(Boolean),
        });
      }
      if (artifactKind === "spreadsheet") {
        const sheet = csvFromTextarea(artifactBody);
        return trpc.artifacts.createSpreadsheet.mutate({
          projectId,
          filename: artifactName,
          headers: sheet.headers,
          rows: sheet.rows,
        });
      }
      const slides = slidesFromTextarea(artifactBody);
      if (slides.length === 0) throw new Error("Add at least one slide");
      return trpc.artifacts.createPresentation.mutate({
        projectId,
        filename: artifactName,
        title: artifactTitle,
        slides,
      });
    },
    onSuccess: async (data) => {
      setResult(JSON.stringify(data, null, 2));
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => setResult(`Artifact creation failed: ${error.message}`),
  });

  if (!session) return null;

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-forge-cyan">
            AppForge Power Tools
          </p>
          <h1 className="forge-h2 text-forge-text-primary mt-2">
            Tools & Plugins
          </h1>
          <p className="text-forge-text-muted mt-2 max-w-3xl">
            These controls call AppForge&apos;s real authenticated plugin APIs. A
            service only shows Connected after its non-mutating verification
            succeeds.
          </p>
        </div>

        <GlassCard hover={false}>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold text-forge-text-primary">
                Plugin Management
              </h2>
              <p className="text-sm text-forge-text-muted">
                {health
                  ? `${health.connected}/${health.total} capabilities verified or implemented`
                  : "Checking live integration health…"}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={healthRefreshing}
              onClick={() =>
                queryClient.invalidateQueries({
                  queryKey: ["ecosystem", "integrations"],
                })
              }
            >
              {healthRefreshing ? "Checking…" : "Recheck"}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {health?.integrations.map((integration) => (
              <div
                key={integration.id}
                className="border border-forge-border bg-forge-bg/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-forge-text-primary">
                      {integration.name}
                    </p>
                    <p className="text-xs text-forge-text-muted mt-1">
                      {integration.job}
                    </p>
                  </div>
                  <Badge tone={stateTone(integration.state)}>
                    {integration.state.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-xs text-forge-text-muted mt-3">
                  {integration.message}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard hover={false}>
            <h2 className="text-lg font-semibold text-forge-text-primary">
              Deep Research
            </h2>
            <input
              className="forge-input w-full mt-4"
              placeholder="Research topic"
              value={researchTopic}
              onChange={(event) => setResearchTopic(event.target.value)}
            />
            <textarea
              className="forge-input w-full mt-3 min-h-28"
              placeholder="Research objective (optional)"
              value={researchObjective}
              onChange={(event) => setResearchObjective(event.target.value)}
            />
            <Button
              className="mt-3"
              disabled={!researchTopic.trim() || research.isPending}
              onClick={() => research.mutate()}
            >
              {research.isPending ? "Researching…" : "Run Deep Research"}
            </Button>
          </GlassCard>

          <GlassCard hover={false}>
            <h2 className="text-lg font-semibold text-forge-text-primary">
              BubblaV Support
            </h2>
            <textarea
              className="forge-input w-full mt-4 min-h-36"
              placeholder="Ask for onboarding, troubleshooting or support…"
              value={supportMessage}
              onChange={(event) => setSupportMessage(event.target.value)}
            />
            <Button
              className="mt-3"
              disabled={!supportMessage.trim() || support.isPending}
              onClick={() => support.mutate()}
            >
              {support.isPending ? "Sending…" : "Send to Support"}
            </Button>
          </GlassCard>

          <GlassCard hover={false}>
            <h2 className="text-lg font-semibold text-forge-text-primary">
              Make Automation
            </h2>
            <input
              className="forge-input w-full mt-4"
              value={automationEvent}
              onChange={(event) => setAutomationEvent(event.target.value)}
              placeholder="Event name"
            />
            <textarea
              className="forge-input w-full mt-3 min-h-32 font-mono text-sm"
              value={automationPayload}
              onChange={(event) => setAutomationPayload(event.target.value)}
              placeholder='{"projectId": 123}'
            />
            <Button
              className="mt-3"
              disabled={!automationEvent.trim() || automation.isPending}
              onClick={() => automation.mutate()}
            >
              {automation.isPending ? "Running…" : "Run Workflow"}
            </Button>
          </GlassCard>

          <GlassCard hover={false}>
            <h2 className="text-lg font-semibold text-forge-text-primary">
              Project Artifacts
            </h2>
            <select
              className="forge-input w-full mt-4"
              value={projectId ?? ""}
              onChange={(event) => setProjectId(Number(event.target.value) || null)}
            >
              <option value="">Choose completed project</option>
              {completedProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title || `Project ${project.id}`}
                </option>
              ))}
            </select>
            <select
              className="forge-input w-full mt-3"
              value={artifactKind}
              onChange={(event) =>
                setArtifactKind(event.target.value as ArtifactKind)
              }
            >
              <option value="document">Document</option>
              <option value="pdf">PDF</option>
              <option value="spreadsheet">Spreadsheet (tab-separated input)</option>
              <option value="presentation">Presentation (--- between slides)</option>
            </select>
            <input
              className="forge-input w-full mt-3"
              value={artifactName}
              onChange={(event) => setArtifactName(event.target.value)}
              placeholder="Filename"
            />
            <input
              className="forge-input w-full mt-3"
              value={artifactTitle}
              onChange={(event) => setArtifactTitle(event.target.value)}
              placeholder="Title"
            />
            <textarea
              className="forge-input w-full mt-3 min-h-40"
              value={artifactBody}
              onChange={(event) => setArtifactBody(event.target.value)}
              placeholder={
                artifactKind === "presentation"
                  ? "Slide title\nSlide body\n---\nNext slide\nMore content"
                  : artifactKind === "spreadsheet"
                    ? "Name\tRevenue\nProduct A\t1000\nProduct B\t2000"
                    : "Artifact content"
              }
            />
            <Button
              className="mt-3"
              disabled={!projectId || createArtifact.isPending}
              onClick={() => createArtifact.mutate()}
            >
              {createArtifact.isPending ? "Creating…" : "Create Artifact"}
            </Button>
          </GlassCard>
        </div>

        {result && (
          <GlassCard hover={false}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold text-forge-text-primary">
                Latest Result
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setResult("")}>
                Clear
              </Button>
            </div>
            <pre className="whitespace-pre-wrap break-words overflow-x-auto text-sm text-forge-text-muted max-h-[32rem] overflow-y-auto">
              {result}
            </pre>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

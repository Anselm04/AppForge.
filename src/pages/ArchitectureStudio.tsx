import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { trpc } from "../utils/trpc.js";
import { ActiveProjectPicker } from "../components/ActiveProjectPicker.js";
import { useStudioProjectId } from "../hooks/useStudioProjectId.js";
import {
  ARCHITECTURE_JURISDICTIONS,
  ARCHITECTURE_LEGAL_DISCLAIMER,
  ARCHITECTURE_PHASES,
  type ArchitectureJurisdiction,
  type UnitSystem,
} from "../lib/architectureStandards.js";
import type { ClashResult } from "../lib/architectureClashCheck.js";
import type { ComplianceResult } from "../lib/architectureComplianceCheck.js";

type Tab =
  | "brief"
  | "concept"
  | "bim"
  | "site"
  | "docs"
  | "construction"
  | "collaboration";

type VersionSnapshot = {
  id: string;
  label: string;
  savedAt: string;
  phase: string;
  data: Record<string, unknown>;
};

type RoomPreview = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: "brief", label: "Pre-design" },
  { id: "concept", label: "Concept" },
  { id: "bim", label: "BIM" },
  { id: "site", label: "Site & interiors" },
  { id: "docs", label: "Docs & cost" },
  { id: "construction", label: "Construction" },
  { id: "collaboration", label: "Collaboration" },
];

export function ArchitectureStudio() {
  const [tab, setTab] = useState<Tab>("brief");
  const [brief, setBrief] = useState("");
  const [location, setLocation] = useState("");
  const [jurisdiction, setJurisdiction] =
    useState<ArchitectureJurisdiction>("OTHER");
  const [units, setUnits] = useState<UnitSystem>("metric");
  const { projectId, setProjectId, parsedProjectId } = useStudioProjectId();
  const [buildingType, setBuildingType] = useState("mixed-use");
  const [floors, setFloors] = useState(2);
  const [budgetUsd, setBudgetUsd] = useState("");
  const [zoningResearch, setZoningResearch] = useState<string | null>(null);
  const [preDesign, setPreDesign] = useState<Record<string, unknown> | null>(
    null,
  );
  const [concept, setConcept] = useState<Record<string, unknown> | null>(null);
  const [sustainability, setSustainability] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [bimModel, setBimModel] = useState<Record<string, unknown> | null>(
    null,
  );
  const [clashes, setClashes] = useState<ClashResult | null>(null);
  const [constructionDocs, setConstructionDocs] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [accessibility, setAccessibility] = useState<ComplianceResult | null>(
    null,
  );
  const [landscape, setLandscape] = useState<Record<string, unknown> | null>(
    null,
  );
  const [interiors, setInteriors] = useState<Record<string, unknown> | null>(
    null,
  );
  const [permits, setPermits] = useState<Record<string, unknown> | null>(null);
  const [boq, setBoq] = useState<Record<string, unknown> | null>(null);
  const [specs, setSpecs] = useState<Record<string, unknown> | null>(null);
  const [adminPack, setAdminPack] = useState<Record<string, unknown> | null>(
    null,
  );
  const [snagging, setSnagging] = useState<Record<string, unknown> | null>(
    null,
  );
  const [postOccupancy, setPostOccupancy] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [clientApproval, setClientApproval] = useState<
    "draft" | "review" | "approved"
  >("draft");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const meta = ARCHITECTURE_JURISDICTIONS[jurisdiction];

  useEffect(() => {
    setUnits(meta.defaultUnits);
  }, [jurisdiction, meta.defaultUnits]);

  const saveVersion = (label: string, data: Record<string, unknown>) => {
    setVersions((prev) => [
      {
        id: crypto.randomUUID(),
        label,
        savedAt: new Date().toISOString(),
        phase: tab,
        data,
      },
      ...prev.slice(0, 19),
    ]);
  };

  const zoningSearch = useMutation({
    mutationFn: () =>
      trpc.capabilities.researchArchitectureZoning.mutate({
        location,
        projectType: buildingType,
        jurisdiction,
      }),
    onSuccess: (data) => {
      const lines = [
        data.answer ? `Summary: ${data.answer}` : "",
        ...data.results.map(
          (r, i) =>
            `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet.slice(0, 150)}`,
        ),
      ].filter(Boolean);
      setZoningResearch(lines.join("\n"));
    },
  });

  const briefGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateArchitectureBrief.mutate({
        brief,
        location,
        jurisdiction,
        units,
        budgetUsd: budgetUsd ? parseFloat(budgetUsd) : undefined,
        zoningResearch: zoningResearch ?? undefined,
      }),
    onSuccess: (data) => {
      setPreDesign(data);
      saveVersion("Pre-design brief", data);
    },
  });

  const conceptGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateConceptDesign.mutate({
        brief,
        location,
        jurisdiction,
        units,
        floors,
        buildingType,
      }),
    onSuccess: (data) => {
      setConcept(data);
      saveVersion("Concept design", data);
    },
  });

  const sustainabilityGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateSustainabilityReport.mutate({
        conceptDesign: concept ?? {},
        location,
        jurisdiction,
      }),
    onSuccess: (data) => {
      setSustainability(data);
      saveVersion("Sustainability report", data);
    },
  });

  const bimGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateBIMModel.mutate({
        conceptDesign: concept ?? {},
        location,
        includeStructural: true,
        includeMEP: true,
      }),
    onSuccess: (data) => {
      setBimModel(data);
      saveVersion("BIM model", data);
    },
  });

  const clashDetect = useMutation({
    mutationFn: () =>
      trpc.capabilities.detectBIMClashes.mutate({ bimModel: bimModel ?? {} }),
    onSuccess: (data) => setClashes(data),
  });

  const docsGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateConstructionDocuments.mutate({
        bimModel: bimModel ?? {},
        jurisdiction,
        units,
      }),
    onSuccess: (data) => {
      setConstructionDocs(data);
      saveVersion("Construction documents", data);
    },
  });

  const accessibilityCheck = useMutation({
    mutationFn: () => {
      const plans = concept?.floorPlans as Array<{ rooms?: RoomPreview[] }>;
      const rooms = plans?.[0]?.rooms ?? [];
      return trpc.capabilities.checkArchitectureAccessibility.mutate({
        floorPlan: {
          rooms: rooms.map((r) => ({
            id: r.id,
            name: r.name,
            type: r.name,
            doorWidthMm: 900,
          })),
          corridorWidthMm: 1500,
          egressDoorCount: 2,
        },
      });
    },
    onSuccess: (data) => setAccessibility(data),
  });

  const landscapeGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateLandscapePlan.mutate({
        siteBrief: brief,
        units,
      }),
    onSuccess: (data) => {
      setLandscape(data);
      saveVersion("Landscape plan", data);
    },
  });

  const interiorGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateInteriorLayout.mutate({
        floorPlan:
          (concept?.floorPlans as Record<string, unknown>[])?.[0] ?? {},
        style: "contemporary",
      }),
    onSuccess: (data) => {
      setInteriors(data);
      saveVersion("Interior layout", data);
    },
  });

  const permitGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generatePermitDrawings.mutate({
        constructionDocs: constructionDocs ?? {},
        jurisdiction,
        councilName: location,
      }),
    onSuccess: (data) => {
      setPermits(data);
      saveVersion("Permit package", data);
    },
  });

  const boqGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateBillOfQuantities.mutate({
        bimModel: bimModel ?? {},
        units,
      }),
    onSuccess: (data) => {
      setBoq(data);
      saveVersion("Bill of quantities", data);
    },
  });

  const specsGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateArchitectureSpecifications.mutate({
        constructionDocs: constructionDocs ?? {},
        jurisdiction,
      }),
    onSuccess: (data) => {
      setSpecs(data);
      saveVersion("Specifications", data);
    },
  });

  const adminGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateConstructionAdminPack.mutate({
        projectName: brief.slice(0, 80) || "Building project",
        phase: "construction",
      }),
    onSuccess: (data) => {
      setAdminPack(data);
      saveVersion("Construction admin", data);
    },
  });

  const snagGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateSnaggingList.mutate({
        projectName: brief.slice(0, 80) || "Building project",
        areas: ["Ground floor", "Level 1", "Exterior"],
      }),
    onSuccess: (data) => {
      setSnagging(data);
      saveVersion("Snagging list", data);
    },
  });

  const postOccGen = useMutation({
    mutationFn: () =>
      trpc.capabilities.generatePostOccupancyPlan.mutate({
        buildingType,
      }),
    onSuccess: (data) => {
      setPostOccupancy(data);
      saveVersion("Post-occupancy plan", data);
    },
  });

  const attach = useMutation({
    mutationFn: (payload: { filename: string; content: string }) => {
      if (!parsedProjectId) throw new Error("Select a project");
      return trpc.capabilities.attachStudioAsset.mutate({
        projectId: parsedProjectId,
        filename: payload.filename,
        content: payload.content,
        kind: "architecture",
      });
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (tab !== "concept" && tab !== "bim")) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    const plans = concept?.floorPlans as Array<{ rooms?: RoomPreview[] }>;
    const rooms = plans?.[0]?.rooms ?? [];
    for (const room of rooms) {
      const rx = 20 + (room.x / 100) * (w - 40);
      const ry = 20 + (room.y / 100) * (h - 40);
      const rw = (room.width / 100) * (w - 40);
      const rh = (room.height / 100) * (h - 40);
      ctx.fillStyle = "#1e3a5f";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = "#60a5fa";
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "11px sans-serif";
      ctx.fillText(room.name, rx + 4, ry + 14);
    }
    if (rooms.length === 0) {
      ctx.fillStyle = "#64748b";
      ctx.font = "14px sans-serif";
      ctx.fillText("Generate concept design to preview floor plan", 40, h / 2);
    }
  }, [concept, tab]);

  const attachBundle = (name: string, data: Record<string, unknown> | null) => {
    if (!parsedProjectId || !data) return;
    attach.mutate({
      filename: name,
      content: JSON.stringify(data, null, 2),
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link
          to="/studio"
          className="text-blue-400 hover:text-blue-300 text-sm mb-4 inline-block"
        >
          ← Creative Studio
        </Link>
        <h1 className="text-3xl font-bold mb-2">
          🏛️ Architecture & BIM Studio
        </h1>
        <p className="text-slate-400 mb-2">
          Complete architectural design and delivery — from client brief through
          construction and handover, for any country.
        </p>
        <p className="text-amber-400/90 text-xs mb-6">
          {ARCHITECTURE_LEGAL_DISCLAIMER}
        </p>

        <ActiveProjectPicker />
        <div className="mb-4 flex gap-2 items-center">
          <label className="text-sm text-slate-400">Attach to project #</label>
          <input
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm w-32"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="ID"
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div>
            <label className="text-xs text-slate-400">Location</label>
            <input
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, country"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Jurisdiction</label>
            <select
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1"
              value={jurisdiction}
              onChange={(e) =>
                setJurisdiction(e.target.value as ArchitectureJurisdiction)
              }
            >
              {Object.values(ARCHITECTURE_JURISDICTIONS).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Units</label>
            <select
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1"
              value={units}
              onChange={(e) => setUnits(e.target.value as UnitSystem)}
            >
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Building type</label>
            <input
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm mt-1"
              value={buildingType}
              onChange={(e) => setBuildingType(e.target.value)}
            />
          </div>
        </div>

        <textarea
          className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm mb-4 min-h-[100px]"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Client brief: goals, site, program, budget, constraints…"
        />

        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-700 pb-2">
          {TAB_LABELS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 rounded-t-lg text-sm ${
                tab === t.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "brief" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Pre-design & briefing</h2>
            <p className="text-sm text-slate-400">
              {meta.buildingCode} · {meta.planningAuthority}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => zoningSearch.mutate()}
                disabled={!location || zoningSearch.isPending}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                {zoningSearch.isPending
                  ? "Searching…"
                  : "Research zoning & codes"}
              </button>
              <button
                type="button"
                onClick={() => briefGen.mutate()}
                disabled={!brief || !location || briefGen.isPending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                {briefGen.isPending
                  ? "Generating…"
                  : "Generate brief & feasibility"}
              </button>
            </div>
            <input
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm"
              value={budgetUsd}
              onChange={(e) => setBudgetUsd(e.target.value)}
              placeholder="Budget USD (optional)"
            />
            {zoningResearch && (
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-48 whitespace-pre-wrap">
                {zoningResearch}
              </pre>
            )}
            {preDesign && (
              <>
                <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-96">
                  {JSON.stringify(preDesign, null, 2)}
                </pre>
                <button
                  type="button"
                  onClick={() => attachBundle("brief.json", preDesign)}
                  className="text-sm bg-green-700 hover:bg-green-600 px-3 py-2 rounded-lg"
                >
                  Attach to project
                </button>
              </>
            )}
          </section>
        )}

        {tab === "concept" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              Concept & schematic design
            </h2>
            <div className="flex flex-wrap gap-2 items-center">
              <label className="text-sm text-slate-400">Floors</label>
              <input
                type="number"
                min={1}
                max={80}
                className="w-20 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-sm"
                value={floors}
                onChange={(e) => setFloors(parseInt(e.target.value, 10) || 1)}
              />
              <button
                type="button"
                onClick={() => conceptGen.mutate()}
                disabled={!brief || conceptGen.isPending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                {conceptGen.isPending
                  ? "Generating…"
                  : "Generate concept & floor plans"}
              </button>
              <button
                type="button"
                onClick={() => sustainabilityGen.mutate()}
                disabled={!concept || sustainabilityGen.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                Sustainability report
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={640}
              height={400}
              className="w-full max-w-2xl border border-slate-700 rounded-xl"
            />
            {concept && (
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-64">
                {JSON.stringify(concept, null, 2)}
              </pre>
            )}
            {sustainability && (
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-48">
                {JSON.stringify(sustainability, null, 2)}
              </pre>
            )}
            {concept && (
              <button
                type="button"
                onClick={() => attachBundle("concept-design.json", concept)}
                className="text-sm bg-green-700 hover:bg-green-600 px-3 py-2 rounded-lg"
              >
                Attach concept to project
              </button>
            )}
          </section>
        )}

        {tab === "bim" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              Coordinated BIM & technical design
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => bimGen.mutate()}
                disabled={!concept || bimGen.isPending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                {bimGen.isPending ? "Building model…" : "Generate BIM model"}
              </button>
              <button
                type="button"
                onClick={() => clashDetect.mutate()}
                disabled={!bimModel || clashDetect.isPending}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                Clash detection
              </button>
              <button
                type="button"
                onClick={() => docsGen.mutate()}
                disabled={!bimModel || docsGen.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                Construction documents
              </button>
              <button
                type="button"
                onClick={() => accessibilityCheck.mutate()}
                disabled={!concept || accessibilityCheck.isPending}
                className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                Accessibility check
              </button>
            </div>
            {clashes && (
              <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm">
                <p>
                  Clashes: {clashes.criticalCount} critical,{" "}
                  {clashes.warningCount} warnings ({clashes.checked} elements)
                </p>
                <ul className="mt-2 text-xs text-slate-400 space-y-1">
                  {clashes.clashes.slice(0, 8).map((c, i) => (
                    <li key={i}>
                      [{c.severity}] {c.description}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {accessibility && (
              <div className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm">
                <p>Accessibility score: {accessibility.score}%</p>
                {accessibility.failures.map((f, i) => (
                  <p key={i} className="text-red-400 text-xs">
                    {f}
                  </p>
                ))}
              </div>
            )}
            {bimModel && (
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-64">
                {JSON.stringify(bimModel, null, 2)}
              </pre>
            )}
            {constructionDocs && (
              <>
                <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-48">
                  {JSON.stringify(constructionDocs, null, 2)}
                </pre>
                <button
                  type="button"
                  onClick={() =>
                    attachBundle(
                      "construction-documents.json",
                      constructionDocs,
                    )
                  }
                  className="text-sm bg-green-700 hover:bg-green-600 px-3 py-2 rounded-lg"
                >
                  Attach construction docs
                </button>
              </>
            )}
          </section>
        )}

        {tab === "site" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              Site, landscape & interiors
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => landscapeGen.mutate()}
                disabled={!brief || landscapeGen.isPending}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                Landscape & site plan
              </button>
              <button
                type="button"
                onClick={() => interiorGen.mutate()}
                disabled={!concept || interiorGen.isPending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                Interior layout & FF&E
              </button>
            </div>
            {landscape && (
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-48">
                {JSON.stringify(landscape, null, 2)}
              </pre>
            )}
            {interiors && (
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-48">
                {JSON.stringify(interiors, null, 2)}
              </pre>
            )}
          </section>
        )}

        {tab === "docs" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              Documentation, permitting & cost
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => permitGen.mutate()}
                disabled={!constructionDocs || permitGen.isPending}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                Permit application pack
              </button>
              <button
                type="button"
                onClick={() => boqGen.mutate()}
                disabled={!bimModel || boqGen.isPending}
                className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                Bill of quantities
              </button>
              <button
                type="button"
                onClick={() => specsGen.mutate()}
                disabled={!constructionDocs || specsGen.isPending}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                Specifications
              </button>
            </div>
            {permits && (
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-40">
                {JSON.stringify(permits, null, 2)}
              </pre>
            )}
            {boq && (
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-40">
                {JSON.stringify(boq, null, 2)}
              </pre>
            )}
            {specs && (
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-40">
                {JSON.stringify(specs, null, 2)}
              </pre>
            )}
          </section>
        )}

        {tab === "construction" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              Construction administration & handover
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => adminGen.mutate()}
                disabled={adminGen.isPending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                Submittals & change orders
              </button>
              <button
                type="button"
                onClick={() => snagGen.mutate()}
                disabled={snagGen.isPending}
                className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                Snagging / defects list
              </button>
              <button
                type="button"
                onClick={() => postOccGen.mutate()}
                disabled={postOccGen.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                Post-occupancy tracking
              </button>
            </div>
            {adminPack && (
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-40">
                {JSON.stringify(adminPack, null, 2)}
              </pre>
            )}
            {snagging && (
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-40">
                {JSON.stringify(snagging, null, 2)}
              </pre>
            )}
            {postOccupancy && (
              <pre className="bg-slate-950 border border-slate-700 rounded-xl p-4 text-xs overflow-auto max-h-40">
                {JSON.stringify(postOccupancy, null, 2)}
              </pre>
            )}
          </section>
        )}

        {tab === "collaboration" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">
              Collaboration & client approval
            </h2>
            <p className="text-sm text-slate-400">
              Version history and formal sign-off at each project phase.
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm">Client approval:</span>
              {(["draft", "review", "approved"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setClientApproval(s)}
                  className={`px-3 py-1 rounded-lg text-sm capitalize ${
                    clientApproval === s
                      ? "bg-blue-600"
                      : "bg-slate-700 hover:bg-slate-600"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <ul className="space-y-2">
              {ARCHITECTURE_PHASES.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between bg-slate-800 rounded-lg px-4 py-2 text-sm"
                >
                  <span>{p.label}</span>
                  <span className="text-slate-500 capitalize">
                    {clientApproval}
                  </span>
                </li>
              ))}
            </ul>
            <h3 className="font-medium mt-4">Design version history</h3>
            {versions.length === 0 ? (
              <p className="text-sm text-slate-500">
                Generate deliverables to build version history.
              </p>
            ) : (
              <ul className="space-y-2">
                {versions.map((v) => (
                  <li
                    key={v.id}
                    className="bg-slate-800 rounded-lg px-4 py-2 text-sm flex justify-between"
                  >
                    <span>
                      {v.label}{" "}
                      <span className="text-slate-500">({v.phase})</span>
                    </span>
                    <span className="text-slate-500 text-xs">
                      {new Date(v.savedAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {attach.isSuccess && (
          <p className="mt-4 text-green-400 text-sm">
            Attached to project at {attach.data?.path}
          </p>
        )}
      </div>
    </div>
  );
}

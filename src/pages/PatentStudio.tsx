import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { trpc } from "../utils/trpc.js";
import {
  PATENT_JURISDICTIONS,
  PATENT_LEGAL_DISCLAIMER,
  type PatentJurisdiction,
  type FilingType,
  resolveFilingType,
} from "../lib/patentJurisdictions.js";
import type { ReferenceCheckResult } from "../lib/patentReferenceCheck.js";

type Tab = "design" | "priorArt" | "spec" | "drawings" | "versions";

type SpecSections = Record<string, string>;

type VersionSnapshot = {
  id: string;
  label: string;
  savedAt: string;
  spec: SpecSections;
  design: Record<string, unknown> | null;
};

type FigureElement = {
  refNumeral: string;
  label: string;
  x: number;
  y: number;
};

type Figure = {
  figureNumber: number;
  view: string;
  elements: FigureElement[];
  caption: string;
};

const SPEC_KEYS = [
  "title",
  "field",
  "background",
  "summary",
  "detailedDescription",
  "claims",
  "abstract",
  "addressForService",
] as const;

export function PatentStudio() {
  const [tab, setTab] = useState<Tab>("design");
  const [concept, setConcept] = useState("");
  const [jurisdiction, setJurisdiction] = useState<PatentJurisdiction>("USPTO");
  const [filingType, setFilingType] = useState<FilingType | "">("");
  const [drawingMode, setDrawingMode] = useState<"informal" | "formal">(
    "informal",
  );
  const [design, setDesign] = useState<Record<string, unknown> | null>(null);
  const [priorArt, setPriorArt] = useState<string | null>(null);
  const [spec, setSpec] = useState<SpecSections>({});
  const [figures, setFigures] = useState<Figure[]>([]);
  const [activeFigure, setActiveFigure] = useState(0);
  const [refCheck, setRefCheck] = useState<ReferenceCheckResult | null>(null);
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [projectId, setProjectId] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const meta = PATENT_JURISDICTIONS[jurisdiction];
  const effectiveFiling = resolveFilingType(
    jurisdiction,
    filingType || undefined,
  );

  const priorArtSearch = useMutation({
    mutationFn: () =>
      trpc.capabilities.searchPriorArt.mutate({ concept, jurisdiction }),
    onSuccess: (data) => {
      const lines = [
        data.answer ? `Summary: ${data.answer}` : "",
        ...data.results.map(
          (r, i) =>
            `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet.slice(0, 150)}`,
        ),
      ].filter(Boolean);
      setPriorArt(lines.join("\n"));
    },
  });

  const inventionDesign = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateInventionDesign.mutate({
        concept,
        priorArtSummary: priorArt ?? undefined,
      }),
    onSuccess: (data) => setDesign(data as Record<string, unknown>),
  });

  const specification = useMutation({
    mutationFn: () =>
      trpc.capabilities.generatePatentSpecification.mutate({
        inventionDesign: design ?? {},
        jurisdiction,
        filingType: filingType || undefined,
        priorArtSummary: priorArt ?? undefined,
      }),
    onSuccess: (data) => {
      const d = data as Record<string, unknown>;
      const next: SpecSections = {};
      for (const key of SPEC_KEYS) {
        const v = d[key];
        if (v !== undefined) {
          next[key] = typeof v === "string" ? v : JSON.stringify(v, null, 2);
        }
      }
      setSpec(next);
      saveVersion("Auto-generated specification", next);
    },
  });

  const drawings = useMutation({
    mutationFn: () =>
      trpc.capabilities.generatePatentDrawings.mutate({
        inventionDesign: design ?? {},
        mode: drawingMode,
      }),
    onSuccess: (data) => {
      const figs = (data as { figures?: Figure[] }).figures ?? [];
      setFigures(figs);
      setActiveFigure(0);
    },
  });

  const checkRefs = useMutation({
    mutationFn: () =>
      trpc.capabilities.checkPatentReferences.mutate({
        specification: Object.values(spec).join("\n"),
        drawingLabels: figures
          .flatMap((f) => f.elements.map((e) => `${e.refNumeral} ${e.label}`))
          .join("\n"),
      }),
    onSuccess: (data) => setRefCheck(data),
  });

  const attach = useMutation({
    mutationFn: () =>
      trpc.capabilities.attachStudioAsset.mutate({
        projectId: parseInt(projectId, 10),
        filename: "patent-bundle.json",
        content: JSON.stringify(
          {
            jurisdiction,
            filingType: effectiveFiling,
            design,
            priorArt,
            specification: spec,
            figures,
            drawingMode,
            disclaimer: PATENT_LEGAL_DISCLAIMER,
          },
          null,
          2,
        ),
        kind: "patent",
      }),
  });

  function saveVersion(label: string, specSnapshot?: SpecSections) {
    const snap: VersionSnapshot = {
      id: `v-${Date.now()}`,
      label,
      savedAt: new Date().toISOString(),
      spec: { ...(specSnapshot ?? spec) },
      design,
    };
    setVersions((prev) => [snap, ...prev].slice(0, 20));
  }

  function restoreVersion(v: VersionSnapshot) {
    setSpec(v.spec);
    if (v.design) setDesign(v.design);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || tab !== "drawings" || figures.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const fig = figures[activeFigure];
    if (!fig) return;

    const w = canvas.width;
    const h = canvas.height;
    const formal = drawingMode === "formal";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = formal ? 2 : 1;
    ctx.fillStyle = "#000000";
    ctx.font = formal ? "12px monospace" : "11px sans-serif";

    ctx.strokeRect(40, 40, w - 80, h - 100);
    ctx.fillText(`FIG. ${fig.figureNumber} — ${fig.view}`, 50, 30);
    ctx.fillText(fig.caption.slice(0, 60), 50, h - 20);

    for (const el of fig.elements) {
      const x = 40 + (el.x / 100) * (w - 80);
      const y = 50 + (el.y / 100) * (h - 120);
      ctx.beginPath();
      ctx.rect(x - 20, y - 15, 40, 30);
      ctx.stroke();
      ctx.fillText(el.refNumeral, x - 8, y + 4);
    }
  }, [tab, figures, activeFigure, drawingMode]);

  const updateSpecField = (key: string, value: string) => {
    setSpec((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <Link to="/studio" className="text-sm text-blue-600 dark:text-blue-400">
          ← Creative Studio
        </Link>
        <h1 className="text-3xl font-bold mt-4 mb-2">
          Invention & Patent Studio
        </h1>

        <div
          role="alert"
          className="mt-4 mb-6 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-sm text-amber-900 dark:text-amber-200"
        >
          <strong>Legal notice:</strong> {PATENT_LEGAL_DISCLAIMER}
        </div>

        <textarea
          className="w-full h-28 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg p-3 mb-3"
          placeholder="Describe your invention concept…"
          value={concept}
          onChange={(e) => setConcept(e.target.value)}
        />

        <div className="flex flex-wrap gap-3 mb-4">
          <label className="text-sm">
            Jurisdiction
            <select
              value={jurisdiction}
              onChange={(e) => {
                setJurisdiction(e.target.value as PatentJurisdiction);
                setFilingType("");
              }}
              className="ml-2 bg-white dark:bg-slate-800 border rounded px-2 py-1"
            >
              {Object.values(PATENT_JURISDICTIONS).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Filing type
            <select
              value={filingType || effectiveFiling}
              onChange={(e) => setFilingType(e.target.value as FilingType)}
              className="ml-2 bg-white dark:bg-slate-800 border rounded px-2 py-1"
            >
              {meta.allowedFilingTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs text-slate-500 self-center">
            {meta.notes}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-300 dark:border-slate-700 pb-2">
          {(
            [
              ["design", "Invention design"],
              ["priorArt", "Prior art"],
              ["spec", "Specification"],
              ["drawings", "Drawings"],
              ["versions", "Versions"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-t-lg text-sm ${
                tab === id
                  ? "bg-slate-200 dark:bg-slate-700"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "design" && (
          <div className="space-y-4">
            <button
              type="button"
              disabled={concept.length < 10 || inventionDesign.isPending}
              onClick={() => inventionDesign.mutate()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
            >
              {inventionDesign.isPending
                ? "Designing…"
                : "Develop invention design"}
            </button>
            {design && (
              <pre className="bg-white dark:bg-slate-800 p-4 rounded-lg text-xs overflow-auto max-h-96 border">
                {JSON.stringify(design, null, 2)}
              </pre>
            )}
          </div>
        )}

        {tab === "priorArt" && (
          <div className="space-y-4">
            <button
              type="button"
              disabled={concept.length < 5 || priorArtSearch.isPending}
              onClick={() => priorArtSearch.mutate()}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
            >
              {priorArtSearch.isPending
                ? "Searching…"
                : "🔍 Search prior art (live web)"}
            </button>
            {priorArt && (
              <pre className="bg-white dark:bg-slate-800 p-4 rounded-lg text-xs whitespace-pre-wrap max-h-64 overflow-auto border">
                {priorArt}
              </pre>
            )}
          </div>
        )}

        {tab === "spec" && (
          <div className="space-y-4">
            <button
              type="button"
              disabled={!design || specification.isPending}
              onClick={() => specification.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
            >
              {specification.isPending
                ? "Drafting…"
                : "Generate patent specification"}
            </button>
            {meta.specificationSections.map((key) => (
              <label key={key} className="block text-sm">
                <span className="font-medium capitalize">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <textarea
                  className="mt-1 w-full h-24 bg-white dark:bg-slate-800 border rounded-lg p-2 font-mono text-xs"
                  value={spec[key] ?? ""}
                  onChange={(e) => updateSpecField(key, e.target.value)}
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => saveVersion("Manual save")}
              className="text-sm text-blue-600 dark:text-blue-400"
            >
              Save version snapshot
            </button>
          </div>
        )}

        {tab === "drawings" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDrawingMode("informal")}
                className={`px-3 py-1 rounded text-sm ${drawingMode === "informal" ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-700"}`}
              >
                Informal (provisional)
              </button>
              <button
                type="button"
                onClick={() => setDrawingMode("formal")}
                className={`px-3 py-1 rounded text-sm ${drawingMode === "formal" ? "bg-blue-600 text-white" : "bg-slate-200 dark:bg-slate-700"}`}
              >
                Formal (complete)
              </button>
            </div>
            <button
              type="button"
              disabled={!design || drawings.isPending}
              onClick={() => drawings.mutate()}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg"
            >
              {drawings.isPending ? "Generating…" : "Generate figure layouts"}
            </button>
            {figures.length > 0 && (
              <>
                <div className="flex gap-2 flex-wrap">
                  {figures.map((f, i) => (
                    <button
                      key={f.figureNumber}
                      type="button"
                      onClick={() => setActiveFigure(i)}
                      className={`px-3 py-1 rounded text-sm ${activeFigure === i ? "bg-slate-800 text-white" : "bg-slate-200 dark:bg-slate-700"}`}
                    >
                      Fig. {f.figureNumber}
                    </button>
                  ))}
                </div>
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  className="w-full border border-slate-400 bg-white rounded"
                />
                <button
                  type="button"
                  disabled={figures.length === 0 || checkRefs.isPending}
                  onClick={() => checkRefs.mutate()}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Check reference numeral consistency
                </button>
                {refCheck && (
                  <div
                    className={`text-sm p-3 rounded ${refCheck.ok ? "bg-green-100 dark:bg-green-900/30" : "bg-amber-100 dark:bg-amber-900/30"}`}
                  >
                    {refCheck.ok
                      ? `All reference numerals match (${refCheck.matched.length} numerals).`
                      : `Mismatch — spec only: ${refCheck.inSpecOnly.join(", ") || "none"}; drawings only: ${refCheck.inDrawingsOnly.join(", ") || "none"}`}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "versions" && (
          <ul className="space-y-2">
            {versions.length === 0 && (
              <p className="text-slate-500 text-sm">No saved versions yet.</p>
            )}
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between bg-white dark:bg-slate-800 border rounded-lg p-3 text-sm"
              >
                <div>
                  <div className="font-medium">{v.label}</div>
                  <div className="text-xs text-slate-500">{v.savedAt}</div>
                </div>
                <button
                  type="button"
                  onClick={() => restoreVersion(v)}
                  className="text-blue-600 dark:text-blue-400"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex flex-wrap gap-2 items-end border-t pt-6 border-slate-300 dark:border-slate-700">
          <input
            placeholder="Project ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border rounded px-2 py-1 w-28 dark:bg-slate-800 dark:border-slate-700"
          />
          <button
            type="button"
            disabled={!projectId || attach.isPending}
            onClick={() => attach.mutate()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
          >
            Attach patent bundle to project
          </button>
        </div>
      </div>
    </div>
  );
}

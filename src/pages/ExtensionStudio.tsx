import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BUILD_CAPABILITIES } from "../lib/buildCapabilities.js";
import {
  EXTENSION_STUDIOS,
  type ExtensionCapabilityId,
} from "../lib/extensionCapabilities.js";
import { EXTENSION_GENERATE_PROCEDURE } from "../routers/extensionProcedures.js";
import { ActiveProjectPicker } from "../components/ActiveProjectPicker.js";
import { useStudioProjectId } from "../hooks/useStudioProjectId.js";
import { trpc } from "../utils/trpc.js";

type Props = {
  studioId: ExtensionCapabilityId;
};

function runExtensionGenerate(
  studioId: ExtensionCapabilityId,
  brief: string,
): Promise<unknown> {
  switch (studioId) {
    case "game":
      return trpc.capabilities.generateGameProject.mutate({ brief });
    case "cad":
      return trpc.capabilities.generateCadProduct.mutate({ brief });
    case "legal":
      return trpc.capabilities.generateLegalDocuments.mutate({ brief });
    case "fintech":
      return trpc.capabilities.generateFintechSchema.mutate({ brief });
    case "healthcare":
      return trpc.capabilities.generateHealthcareConfig.mutate({ brief });
    case "mobile":
      return trpc.capabilities.generateMobilePackaging.mutate({ brief });
    case "voice":
      return trpc.capabilities.generateVoicePodcast.mutate({ brief });
    case "data":
      return trpc.capabilities.generateBiDashboard.mutate({ brief });
    case "localization":
      return trpc.capabilities.generateLocalizationBundle.mutate({ brief });
    case "collab":
      return trpc.capabilities.generateCollabRoom.mutate({ brief });
    default: {
      const procedureName = EXTENSION_GENERATE_PROCEDURE[studioId];
      throw new Error(`Unsupported extension studio: ${procedureName}`);
    }
  }
}

export function ExtensionStudio({ studioId }: Props) {
  const meta = BUILD_CAPABILITIES[studioId];
  const studio = EXTENSION_STUDIOS[studioId];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);

  const [brief, setBrief] = useState("");
  const [plan, setPlan] = useState<Record<string, unknown> | null>(null);
  const { projectId, setProjectId, parsedProjectId } = useStudioProjectId();

  const generate = useMutation({
    mutationFn: () => runExtensionGenerate(studioId, brief),
    onSuccess: (data) => setPlan(data as Record<string, unknown>),
  });

  const attach = useMutation({
    mutationFn: (content: string) => {
      if (!parsedProjectId) throw new Error("Select a project");
      return trpc.capabilities.attachStudioAsset.mutate({
        projectId: parsedProjectId,
        filename: studio.attachFilename,
        content,
        kind: studio.attachKind,
      });
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || studio.preview === "none") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let t = 0;
    const draw = () => {
      t += 0.03;
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);

      if (studio.preview === "game") {
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, h * 0.75, w, h * 0.25);
        const x = w / 2 + Math.sin(t) * (w * 0.25);
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(x - 20, h * 0.75 - 40, 40, 40);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "12px system-ui";
        ctx.fillText("WebGL / canvas game preview", 16, 24);
      } else if (studio.preview === "cad") {
        const cx = w / 2;
        const cy = h / 2;
        const size = 60 + Math.sin(t) * 8;
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - size, cy - size * 0.6, size * 2, size * 1.2);
        ctx.beginPath();
        ctx.moveTo(cx - size, cy - size * 0.6);
        ctx.lineTo(cx, cy - size * 0.6 - 30);
        ctx.lineTo(cx + size, cy - size * 0.6);
        ctx.stroke();
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "12px system-ui";
        ctx.fillText("3D product mesh preview (Three.js export)", 16, 24);
      }

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [studio.preview]);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/studio" className="text-sm text-slate-400 hover:text-white">
          ← Creative Studio
        </Link>
        <h1 className="text-3xl font-bold mt-4 mb-2">
          {meta.icon} {meta.label}
        </h1>
        <p className="text-slate-400 mb-4">{meta.description}</p>

        {studio.disclaimer && (
          <p className="text-amber-400/90 text-xs mb-6 p-3 rounded-lg border border-amber-800/50 bg-amber-950/30">
            {studio.disclaimer}
          </p>
        )}

        <textarea
          className="w-full h-28 bg-slate-800 border border-slate-700 rounded-lg p-3 mb-4 text-sm"
          placeholder="Describe what you want to build…"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />

        <button
          type="button"
          disabled={brief.length < 5 || generate.isPending}
          onClick={() => generate.mutate()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-4 py-2 rounded-lg text-sm mb-6"
        >
          {generate.isPending ? "Generating…" : "Generate plan"}
        </button>

        {studio.preview !== "none" && (
          <canvas
            ref={canvasRef}
            width={720}
            height={280}
            className="w-full rounded-lg border border-slate-700 mb-6"
          />
        )}

        {plan && (
          <pre className="bg-slate-800 p-4 rounded-lg text-xs overflow-auto max-h-80 mb-6">
            {JSON.stringify(plan, null, 2)}
          </pre>
        )}

        <ActiveProjectPicker />
        <div className="flex flex-wrap gap-2 items-end pt-4 border-t border-slate-700">
          <input
            placeholder="Project ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 w-28 text-sm"
          />
          <button
            type="button"
            disabled={!parsedProjectId || !plan || attach.isPending}
            onClick={() => attach.mutate(JSON.stringify(plan, null, 2))}
            className="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded-lg text-sm"
          >
            Attach to project
          </button>
        </div>

        {attach.isSuccess && (
          <p className="mt-3 text-green-400 text-sm">
            Saved to {attach.data?.path}
          </p>
        )}
      </div>
    </div>
  );
}

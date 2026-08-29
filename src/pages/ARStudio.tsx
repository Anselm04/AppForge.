import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ActiveProjectPicker } from "../components/ActiveProjectPicker.js";
import { useStudioProjectId } from "../hooks/useStudioProjectId.js";
import { trpc } from "../utils/trpc.js";

export function ARStudio() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [description, setDescription] = useState("");
  const [scene, setScene] = useState<Record<string, unknown> | null>(null);
  const [xrSupported, setXrSupported] = useState(false);
  const { projectId, setProjectId, parsedProjectId } = useStudioProjectId();
  const animRef = useRef<number>(0);

  const generate = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateARScene.mutate({
        description,
        platform: "webxr",
      }),
    onSuccess: (data) => setScene(data as Record<string, unknown>),
  });

  const attach = useMutation({
    mutationFn: (content: string) => {
      if (!parsedProjectId) throw new Error("Select a project");
      return trpc.capabilities.attachStudioAsset.mutate({
        projectId: parsedProjectId,
        filename: "scene.json",
        content,
        kind: "ar",
      });
    },
  });

  useEffect(() => {
    if (typeof navigator !== "undefined" && "xr" in navigator) {
      void (
        navigator as Navigator & {
          xr?: { isSessionSupported: (m: string) => Promise<boolean> };
        }
      ).xr
        ?.isSessionSupported("immersive-ar")
        .then(setXrSupported)
        .catch(() => setXrSupported(false));
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let t = 0;
    const draw = () => {
      t += 0.02;
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height * 0.7);
      ctx.lineTo(canvas.width, canvas.height * 0.7);
      ctx.stroke();
      const x = canvas.width / 2 + Math.sin(t) * 40;
      const y = canvas.height * 0.55;
      ctx.fillStyle = "#a78bfa";
      ctx.fillRect(x - 30, y - 30, 60, 60);
      ctx.fillStyle = "#fff";
      ctx.font = "14px system-ui";
      ctx.fillText("AR anchor preview", 16, 28);
      if (!xrSupported) {
        ctx.fillStyle = "#fbbf24";
        ctx.fillText("WebXR AR not available — 3D fallback", 16, 48);
      }
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [xrSupported]);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link to="/studio" className="text-sm text-slate-400 hover:text-white">
          ← Creative Studio
        </Link>
        <h1 className="text-3xl font-bold mt-4 mb-2">AR Studio</h1>
        <p className="text-slate-400 mb-6">
          Design interactive AR experiences — WebXR when supported, 3D fallback
          preview otherwise.
        </p>

        <textarea
          className="w-full h-24 bg-slate-800 border border-slate-700 rounded-lg p-3 mb-4"
          placeholder="Describe your AR experience…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button
          type="button"
          disabled={description.length < 5 || generate.isPending}
          onClick={() => generate.mutate()}
          className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-600 px-4 py-2 rounded-lg mb-6"
        >
          {generate.isPending ? "Planning…" : "Generate AR scene plan"}
        </button>

        <canvas
          ref={canvasRef}
          width={720}
          height={400}
          className="w-full rounded-lg border border-slate-700 mb-6"
        />

        {scene && (
          <pre className="bg-slate-800 p-4 rounded-lg text-xs overflow-auto max-h-48 mb-6">
            {JSON.stringify(scene, null, 2)}
          </pre>
        )}

        <ActiveProjectPicker />
        <div className="flex gap-2 items-end pt-4">
          <input
            placeholder="Project ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 w-28"
          />
          <button
            type="button"
            disabled={!parsedProjectId || !scene || attach.isPending}
            onClick={() => attach.mutate(JSON.stringify(scene, null, 2))}
            className="bg-slate-600 px-4 py-2 rounded-lg text-sm"
          >
            Attach to project
          </button>
        </div>
      </div>
    </div>
  );
}

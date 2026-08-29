import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ActiveProjectPicker } from "../components/ActiveProjectPicker.js";
import { useStudioProjectId } from "../hooks/useStudioProjectId.js";
import { trpc } from "../utils/trpc.js";

type Scene = {
  id: string;
  startSec: number;
  endSec: number;
  visual: string;
  narration: string;
  onScreenText?: string;
};

export function VideoStudio() {
  const [concept, setConcept] = useState("");
  const [duration, setDuration] = useState(30);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [recording, setRecording] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const { projectId, setProjectId, parsedProjectId } = useStudioProjectId();

  const storyboard = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateVideoStoryboard.mutate({
        concept,
        durationSec: duration,
      }),
    onSuccess: (data) => {
      if (data.scenes) setScenes(data.scenes);
    },
  });

  const attach = useMutation({
    mutationFn: (payload: { filename: string; content: string }) => {
      if (!parsedProjectId) throw new Error("Select a project");
      return trpc.capabilities.attachStudioAsset.mutate({
        projectId: parsedProjectId,
        filename: payload.filename,
        content: payload.content,
        kind: "video",
      });
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || scenes.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    const interval = setInterval(() => {
      const scene = scenes[frame % scenes.length];
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 24px system-ui";
      ctx.fillText(
        scene?.onScreenText || scene?.visual?.slice(0, 40) || "Scene",
        40,
        80,
      );
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "16px system-ui";
      ctx.fillText(scene?.narration?.slice(0, 80) || "", 40, 120);
      frame++;
    }, 1000);
    return () => clearInterval(interval);
  }, [scenes]);

  const startRecording = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stream = canvas.captureStream(15);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setExportUrl(URL.createObjectURL(blob));
    };
    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <Link to="/studio" className="text-sm text-slate-400 hover:text-white">
          ← Creative Studio
        </Link>
        <h1 className="text-3xl font-bold mt-4 mb-2">Video Studio</h1>
        <p className="text-slate-400 mb-6">
          AI storyboards + canvas preview + WebM export. Attach manifest to your
          project for the build pipeline.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <textarea
              className="w-full h-28 bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm"
              placeholder="Video concept…"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
            />
            <label className="text-sm text-slate-400 block">
              Duration (sec)
              <input
                type="number"
                min={5}
                max={180}
                value={duration}
                onChange={(e) =>
                  setDuration(parseInt(e.target.value, 10) || 30)
                }
                className="ml-2 w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1"
              />
            </label>
            <button
              type="button"
              disabled={concept.length < 5 || storyboard.isPending}
              onClick={() => storyboard.mutate()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-4 py-2 rounded-lg text-sm font-medium"
            >
              {storyboard.isPending ? "Generating…" : "Generate storyboard"}
            </button>

            {scenes.length > 0 && (
              <ul className="text-sm space-y-2 max-h-48 overflow-auto">
                {scenes.map((s) => (
                  <li key={s.id} className="bg-slate-800 p-2 rounded">
                    <span className="text-blue-400">
                      {s.startSec}s–{s.endSec}s
                    </span>{" "}
                    {s.visual}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <canvas
              ref={canvasRef}
              width={640}
              height={360}
              className="w-full bg-black rounded-lg border border-slate-700"
            />
            <div className="flex gap-2 mt-3">
              {!recording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={scenes.length === 0}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-slate-600 px-4 py-2 rounded-lg text-sm"
                >
                  Record preview
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="bg-slate-600 px-4 py-2 rounded-lg text-sm"
                >
                  Stop
                </button>
              )}
              {exportUrl && (
                <a
                  href={exportUrl}
                  download="appforge-preview.webm"
                  className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm"
                >
                  Download WebM
                </a>
              )}
            </div>
          </div>
        </div>

        <ActiveProjectPicker />
        <div className="mt-4 flex flex-wrap gap-2 items-end">
          <label className="text-sm">
            Attach to project ID
            <input
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="ml-2 bg-slate-800 border border-slate-700 rounded px-2 py-1 w-24"
            />
          </label>
          <button
            type="button"
            disabled={
              !parsedProjectId || scenes.length === 0 || attach.isPending
            }
            onClick={() =>
              attach.mutate({
                filename: "storyboard.json",
                content: JSON.stringify({ duration, scenes }, null, 2),
              })
            }
            className="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded-lg text-sm"
          >
            Save storyboard to project
          </button>
        </div>
      </div>
    </div>
  );
}

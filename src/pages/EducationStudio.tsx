import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ActiveProjectPicker } from "../components/ActiveProjectPicker.js";
import { useStudioProjectId } from "../hooks/useStudioProjectId.js";
import { trpc } from "../utils/trpc.js";

type Tab = "course" | "class" | "classroom";

type WhiteboardStroke = { x: number; y: number };

export function EducationStudio() {
  const [tab, setTab] = useState<Tab>("course");
  const [subject, setSubject] = useState("");
  const [audience, setAudience] = useState("high school");
  const [coursePlan, setCoursePlan] = useState<Record<string, unknown> | null>(
    null,
  );
  const [classPlan, setClassPlan] = useState<Record<string, unknown> | null>(
    null,
  );
  const [classroomPlan, setClassroomPlan] = useState<Record<
    string,
    unknown
  > | null>(null);
  const { projectId, setProjectId, parsedProjectId } = useStudioProjectId();
  const [research, setResearch] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const strokesRef = useRef<WhiteboardStroke[][]>([]);
  const currentStrokeRef = useRef<WhiteboardStroke[]>([]);
  const animRef = useRef(0);

  const generateCourse = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateCourse.mutate({ subject, audience }),
    onSuccess: (data) => setCoursePlan(data as Record<string, unknown>),
  });

  const generateClass = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateClass.mutate({
        subject,
        audience,
        durationMin: 50,
      }),
    onSuccess: (data) => setClassPlan(data as Record<string, unknown>),
  });

  const generateClassroom = useMutation({
    mutationFn: () =>
      trpc.capabilities.generateVirtualClassroom.mutate({
        subject,
        features: ["whiteboard", "3d_models", "live_chat", "ar_objects"],
      }),
    onSuccess: (data) => setClassroomPlan(data as Record<string, unknown>),
  });

  const webResearch = useMutation({
    mutationFn: () =>
      trpc.capabilities.researchEducation.mutate({ topic: subject, audience }),
    onSuccess: (data) => {
      const lines = [
        data.answer ? `Summary: ${data.answer}` : "",
        ...data.results.map(
          (r, i) =>
            `${i + 1}. ${r.title} — ${r.url}\n   ${r.snippet.slice(0, 120)}`,
        ),
      ].filter(Boolean);
      setResearch(lines.join("\n"));
    },
  });

  const attach = useMutation({
    mutationFn: (payload: { filename: string; content: string }) => {
      if (!parsedProjectId) throw new Error("Select a project");
      return trpc.capabilities.attachStudioAsset.mutate({
        projectId: parsedProjectId,
        filename: payload.filename,
        content: payload.content,
        kind: "education",
      });
    },
  });

  // AR virtual classroom preview: floor plane + 3D cube + whiteboard overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || tab !== "classroom") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, w, h);

      // Classroom floor (AR plane)
      ctx.fillStyle = "#1e3a5f";
      ctx.beginPath();
      ctx.moveTo(0, h * 0.72);
      ctx.lineTo(w, h * 0.72);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Virtual whiteboard
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(w * 0.08, h * 0.1, w * 0.55, h * 0.45);
      ctx.strokeStyle = "#94a3b8";
      ctx.strokeRect(w * 0.08, h * 0.1, w * 0.55, h * 0.45);
      ctx.fillStyle = "#334155";
      ctx.font = "12px system-ui";
      ctx.fillText("Virtual whiteboard", w * 0.1, h * 0.14);

      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      for (const stroke of strokesRef.current) {
        if (stroke.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(stroke[0].x, stroke[0].y);
        for (let i = 1; i < stroke.length; i++) {
          ctx.lineTo(stroke[i].x, stroke[i].y);
        }
        ctx.stroke();
      }

      // 3D teaching model (AR object placeholder)
      const t = Date.now() / 1000;
      const cx = w * 0.78;
      const cy = h * 0.55 + Math.sin(t) * 6;
      const size = 48;
      ctx.fillStyle = "#a78bfa";
      ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
      ctx.fillStyle = "#e9d5ff";
      ctx.fillRect(cx - size / 4, cy - size / 4, size / 2, size / 2);
      ctx.fillStyle = "#fff";
      ctx.font = "11px system-ui";
      ctx.fillText("AR 3D model", cx - 32, cy + size);

      // Participant avatars
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(w * 0.15, h * 0.82, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.arc(w * 0.28, h * 0.85, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px system-ui";
      ctx.fillText("Teacher · Students (live)", w * 0.1, h * 0.95);

      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [tab]);

  const pointerPos = (
    e:
      React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      if (!t) return null;
      return {
        x: (t.clientX - rect.left) * scaleX,
        y: (t.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (
    e:
      React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const p = pointerPos(e);
    if (!p) return;
    drawingRef.current = true;
    currentStrokeRef.current = [p];
  };

  const moveDraw = (
    e:
      React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!drawingRef.current) return;
    const p = pointerPos(e);
    if (!p) return;
    currentStrokeRef.current.push(p);
  };

  const endDraw = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (currentStrokeRef.current.length > 1) {
      strokesRef.current.push([...currentStrokeRef.current]);
    }
    currentStrokeRef.current = [];
  };

  const exportBundle = () =>
    JSON.stringify(
      {
        subject,
        audience,
        course: coursePlan,
        classSession: classPlan,
        virtualClassroom: classroomPlan,
        whiteboardStrokes: strokesRef.current,
        researchNotes: research,
      },
      null,
      2,
    );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <Link to="/studio" className="text-sm text-slate-400 hover:text-white">
          ← Creative Studio
        </Link>
        <h1 className="text-3xl font-bold mt-4 mb-2">Education Studio</h1>
        <p className="text-slate-400 mb-6 max-w-2xl">
          Build courses and live classes with live web research. Design AR
          virtual classrooms with interactive whiteboards, 3D models, and
          layered AR objects for online teaching.
        </p>

        <input
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 mb-3"
          placeholder="Subject or topic (e.g. Introduction to Biology)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
        <input
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 mb-4"
          placeholder="Audience (e.g. high school, university, corporate)"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
        />

        <button
          type="button"
          disabled={subject.length < 3 || webResearch.isPending}
          onClick={() => webResearch.mutate()}
          className="mb-6 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 px-4 py-2 rounded-lg text-sm"
        >
          {webResearch.isPending
            ? "Researching…"
            : "🔍 Research curriculum (live web)"}
        </button>

        {research && (
          <pre className="mb-6 bg-slate-800 p-4 rounded-lg text-xs text-green-300 max-h-40 overflow-auto whitespace-pre-wrap">
            {research}
          </pre>
        )}

        <div className="flex gap-2 mb-6 border-b border-slate-700 pb-2">
          {(
            [
              ["course", "Course builder"],
              ["class", "Class session"],
              ["classroom", "AR classroom"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-t-lg text-sm ${
                tab === id
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "course" && (
          <div className="space-y-4">
            <button
              type="button"
              disabled={subject.length < 3 || generateCourse.isPending}
              onClick={() => generateCourse.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 px-4 py-2 rounded-lg"
            >
              {generateCourse.isPending
                ? "Building…"
                : "Generate course outline"}
            </button>
            {coursePlan && (
              <pre className="bg-slate-800 p-4 rounded-lg text-xs overflow-auto max-h-64">
                {JSON.stringify(coursePlan, null, 2)}
              </pre>
            )}
          </div>
        )}

        {tab === "class" && (
          <div className="space-y-4">
            <button
              type="button"
              disabled={subject.length < 3 || generateClass.isPending}
              onClick={() => generateClass.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 px-4 py-2 rounded-lg"
            >
              {generateClass.isPending
                ? "Planning…"
                : "Generate live class plan"}
            </button>
            {classPlan && (
              <pre className="bg-slate-800 p-4 rounded-lg text-xs overflow-auto max-h-64">
                {JSON.stringify(classPlan, null, 2)}
              </pre>
            )}
          </div>
        )}

        {tab === "classroom" && (
          <div className="space-y-4">
            <button
              type="button"
              disabled={subject.length < 3 || generateClassroom.isPending}
              onClick={() => generateClassroom.mutate()}
              className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-600 px-4 py-2 rounded-lg"
            >
              {generateClassroom.isPending
                ? "Designing…"
                : "Generate AR classroom spec"}
            </button>
            <p className="text-xs text-slate-500">
              Draw on the whiteboard to preview the virtual classroom
              experience.
            </p>
            <canvas
              ref={canvasRef}
              width={800}
              height={450}
              className="w-full rounded-lg border border-slate-600 touch-none cursor-crosshair"
              onMouseDown={startDraw}
              onMouseMove={moveDraw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={moveDraw}
              onTouchEnd={endDraw}
            />
            {classroomPlan && (
              <pre className="bg-slate-800 p-4 rounded-lg text-xs overflow-auto max-h-48">
                {JSON.stringify(classroomPlan, null, 2)}
              </pre>
            )}
          </div>
        )}

        <ActiveProjectPicker />
        <div className="mt-4 flex flex-wrap gap-2 items-end border-t border-slate-700 pt-6">
          <input
            placeholder="Project ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 w-28"
          />
          <button
            type="button"
            disabled={
              !parsedProjectId ||
              (!coursePlan && !classPlan && !classroomPlan) ||
              attach.isPending
            }
            onClick={() =>
              attach.mutate({
                filename: "education-bundle.json",
                content: exportBundle(),
              })
            }
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 px-4 py-2 rounded-lg text-sm"
          >
            Attach education bundle to project
          </button>
        </div>
      </div>
    </div>
  );
}

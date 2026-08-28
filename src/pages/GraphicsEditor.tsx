import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

// ── Types ──
type Tool = "select" | "rect" | "circle" | "text" | "line" | "arrow" | "image";

interface GraphicElement {
  id: string;
  type: Tool;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  color: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  radius: number;
  fontSize: number;
  fontWeight: string;
  glow: boolean;
  shadow: boolean;
  gradient: string | null;
  locked: boolean;
  visible: boolean;
}

interface Point {
  x: number;
  y: number;
}

// ── Premium Presets ──
const PREMIUM_GRADIENTS: Record<string, [string, string]> = {
  "blue-cyan": ["#4aa3ff", "#00e5ff"],
  "gold-amber": ["#fbbf24", "#d97706"],
  "violet-pink": ["#a855f7", "#ec4899"],
  "teal-emerald": ["#14b8a6", "#10b981"],
  "silver-steel": ["#e2e8f0", "#64748b"],
  "rose-red": ["#f43f5e", "#dc2626"],
  "orange-amber": ["#f97316", "#f59e0b"],
};

const SOLID_COLORS = [
  "#4aa3ff",
  "#00e5ff",
  "#2563eb",
  "#a855f7",
  "#f43f5e",
  "#fbbf24",
  "#14b8a6",
  "#22c55e",
  "#e2e8f0",
  "#94a3b8",
  "#64748b",
  "#475569",
  "#1e293b",
  "#0f172a",
  "#ffffff",
];

const TEMPLATES = [
  { id: "social-post", name: "Social Post", w: 1200, h: 630 },
  { id: "app-mockup", name: "App Mockup", w: 800, h: 1000 },
  { id: "logo-canvas", name: "Logo Canvas", w: 600, h: 600 },
  { id: "diagram", name: "Tech Diagram", w: 1200, h: 800 },
  { id: "hero-banner", name: "Hero Banner", w: 1920, h: 1080 },
  { id: "icon", name: "App Icon", w: 512, h: 512 },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function gradientSvg(id: string, colors: [string, string], angle = 0) {
  return `  <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${angle})">
    <stop offset="0%" stop-color="${colors[0]}" />
    <stop offset="100%" stop-color="${colors[1]}" />
  </linearGradient>`;
}

function buildSvgExport(
  elements: GraphicElement[],
  w: number,
  h: number,
): string {
  const defs: string[] = [];
  const usedGradients = new Set<string>();
  const body: string[] = [];

  elements
    .filter((e) => e.visible)
    .forEach((el, i) => {
      let fill = el.color;
      let stroke = el.stroke;
      let opacity = el.opacity;
      let filterRef = "";

      if (el.gradient && PREMIUM_GRADIENTS[el.gradient]) {
        const gradId = `g${i}`;
        if (!usedGradients.has(gradId)) {
          defs.push(gradientSvg(gradId, PREMIUM_GRADIENTS[el.gradient]));
          usedGradients.add(gradId);
        }
        fill = `url(#${gradId})`;
      }

      if (el.shadow) {
        const sid = `sd${i}`;
        defs.push(
          `  <filter id="${sid}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.35"/></filter>`,
        );
        filterRef = ` filter="url(#${sid})"`;
      }

      if (el.glow) {
        const gid = `gl${i}`;
        defs.push(
          `  <filter id="${gid}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`,
        );
        filterRef = ` filter="url(#${gid})"`;
      }

      const style = `fill="${fill}" stroke="${stroke}" stroke-width="${el.strokeWidth}" opacity="${opacity}"${filterRef}`;

      if (el.type === "rect") {
        body.push(
          `  <rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${el.radius}" ${style} />`,
        );
      } else if (el.type === "circle") {
        const r = Math.min(el.w, el.h) / 2;
        const cx = el.x + el.w / 2;
        const cy = el.y + el.h / 2;
        body.push(
          `  <ellipse cx="${cx}" cy="${cy}" rx="${el.w / 2}" ry="${el.h / 2}" ${style} />`,
        );
      } else if (el.type === "text") {
        body.push(
          `  <text x="${el.x}" y="${el.y + el.fontSize}" font-family="Inter,system-ui,sans-serif" font-size="${el.fontSize}" font-weight="${el.fontWeight}" fill="${el.color}" opacity="${opacity}"${filterRef}>${el.text || ""}</text>`,
        );
      } else if (el.type === "line" || el.type === "arrow") {
        body.push(
          `  <line x1="${el.x}" y1="${el.y}" x2="${el.x + el.w}" y2="${el.y + el.h}" stroke="${el.color}" stroke-width="${el.strokeWidth}" opacity="${opacity}" stroke-linecap="round"${filterRef} />`,
        );
        if (el.type === "arrow") {
          const angle = Math.atan2(el.h, el.w);
          const ax = el.x + el.w;
          const ay = el.y + el.h;
          const s = el.strokeWidth * 3;
          body.push(
            `  <polygon points="${ax},${ay} ${ax - s * Math.cos(angle - 0.5)},${ay - s * Math.sin(angle - 0.5)} ${ax - s * Math.cos(angle + 0.5)},${ay - s * Math.sin(angle + 0.5)}" fill="${el.color}" opacity="${opacity}"${filterRef} />`,
          );
        }
      } else if (el.type === "image") {
        body.push(
          `  <rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${el.radius}" fill="#1e293b" stroke="${el.stroke}" stroke-width="${el.strokeWidth}" opacity="${opacity}" stroke-dasharray="6 4"${filterRef} />`,
        );
        body.push(
          `  <text x="${el.x + el.w / 2}" y="${el.y + el.h / 2 + 6}" text-anchor="middle" font-family="monospace" font-size="12" fill="${el.color}" opacity="0.5">IMG</text>`,
        );
      }
    });

  const bgRect = `<rect width="${w}" height="${h}" fill="#080c18" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
<defs>
${defs.join("\n")}
</defs>
${bgRect}
${body.join("\n")}
</svg>`;
}

export function GraphicsEditor() {
  const navigate = useNavigate();
  const [attachProjectId, setAttachProjectId] = useState<number | "">("");
  const [attachFilename, setAttachFilename] = useState("graphic.svg");
  const [attachStatus, setAttachStatus] = useState<string | null>(null);

  const { data: userProjects } = useQuery({
    queryKey: ["projects", "list"],
    queryFn: () => trpc.projects.list.query(),
  });

  const attachToProject = useMutation({
    mutationFn: (payload: {
      projectId: number;
      filename: string;
      content: string;
    }) =>
      trpc.assets.attach.mutate({
        projectId: payload.projectId,
        filename: payload.filename,
        mimeType: "image/svg+xml",
        content: payload.content,
      }),
    onSuccess: (data) => {
      setAttachStatus(`Attached to ${data.path}`);
    },
    onError: (err: Error) => {
      setAttachStatus(err.message || "Attach failed");
    },
  });

  const [canvasW, setCanvasW] = useState(1200);
  const [canvasH, setCanvasH] = useState(630);
  const [scale, setScale] = useState(0.6);
  const [elements, setElements] = useState<GraphicElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [showLayers, setShowLayers] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [startPt, setStartPt] = useState<Point | null>(null);
  const [lastPt, setLastPt] = useState<Point | null>(null);
  const [svgOutput, setSvgOutput] = useState("");
  const [showExport, setShowExport] = useState(false);
  const [history, setHistory] = useState<GraphicElement[][]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const canvasRef = useRef<HTMLDivElement>(null);

  const sel = elements.find((e) => e.id === selectedId) || null;

  function pushHistory(next: GraphicElement[]) {
    const trimmed = history.slice(0, historyIdx + 1);
    trimmed.push(next);
    if (trimmed.length > 30) trimmed.shift();
    setHistory(trimmed);
    setHistoryIdx(trimmed.length - 1);
  }

  function updateElements(fn: (prev: GraphicElement[]) => GraphicElement[]) {
    setElements((prev) => {
      const next = fn(prev);
      pushHistory(next);
      return next;
    });
  }

  function undo() {
    if (historyIdx > 0) {
      setHistoryIdx(historyIdx - 1);
      setElements(history[historyIdx - 1]);
    }
  }
  function redo() {
    if (historyIdx < history.length - 1) {
      setHistoryIdx(historyIdx + 1);
      setElements(history[historyIdx + 1]);
    }
  }

  function addElement(el: GraphicElement) {
    updateElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  }

  function deleteSelected() {
    if (!selectedId) return;
    updateElements((prev) => prev.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  }

  function duplicateSelected() {
    if (!sel) return;
    const dup: GraphicElement = {
      ...sel,
      id: uid(),
      x: sel.x + 20,
      y: sel.y + 20,
    };
    updateElements((prev) => [...prev, dup]);
    setSelectedId(dup.id);
  }

  function bringToFront() {
    if (!selectedId) return;
    updateElements((prev) => {
      const item = prev.find((e) => e.id === selectedId)!;
      return [...prev.filter((e) => e.id !== selectedId), item];
    });
  }

  function sendToBack() {
    if (!selectedId) return;
    updateElements((prev) => {
      const item = prev.find((e) => e.id === selectedId)!;
      return [item, ...prev.filter((e) => e.id !== selectedId)];
    });
  }

  function updateSelected(partial: Partial<GraphicElement>) {
    if (!selectedId) return;
    updateElements((prev) =>
      prev.map((e) => (e.id === selectedId ? { ...e, ...partial } : e)),
    );
  }

  const getCanvasPoint = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    },
    [scale],
  );

  function onMouseDown(e: React.MouseEvent) {
    const pt = getCanvasPoint(e);
    setStartPt(pt);
    setLastPt(pt);

    if (sel && tool === "select") {
      const handleSize = 8 / scale;
      const handles = [
        { key: "nw", x: sel.x, y: sel.y },
        { key: "ne", x: sel.x + sel.w, y: sel.y },
        { key: "sw", x: sel.x, y: sel.y + sel.h },
        { key: "se", x: sel.x + sel.w, y: sel.y + sel.h },
      ];
      for (const h of handles) {
        if (
          Math.abs(pt.x - h.x) < handleSize &&
          Math.abs(pt.y - h.y) < handleSize
        ) {
          setResizeHandle(h.key);
          setDragging(true);
          return;
        }
      }
      if (
        pt.x >= sel.x &&
        pt.x <= sel.x + sel.w &&
        pt.y >= sel.y &&
        pt.y <= sel.y + sel.h
      ) {
        setDragging(true);
        setResizeHandle("move");
        return;
      }
    }

    if (tool === "select") {
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (!el.visible || el.locked) continue;
        let hit = false;
        if (el.type === "rect" || el.type === "image") {
          hit =
            pt.x >= el.x &&
            pt.x <= el.x + el.w &&
            pt.y >= el.y &&
            pt.y <= el.y + el.h;
        } else if (el.type === "circle") {
          const cx = el.x + el.w / 2;
          const cy = el.y + el.h / 2;
          hit =
            ((pt.x - cx) / (el.w / 2)) ** 2 + ((pt.y - cy) / (el.h / 2)) ** 2 <=
            1.1;
        } else if (el.type === "text") {
          hit =
            pt.x >= el.x &&
            pt.x <= el.x + el.w &&
            pt.y >= el.y &&
            pt.y <= el.y + el.h;
        } else if (el.type === "line" || el.type === "arrow") {
          const dx = el.w;
          const dy = el.h;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            const proj = ((pt.x - el.x) * dx + (pt.y - el.y) * dy) / len;
            const perp =
              Math.abs((pt.x - el.x) * -dy + (pt.y - el.y) * dx) / len;
            hit = proj >= -10 && proj <= len + 10 && perp < 12;
          }
        }
        if (hit) {
          setSelectedId(el.id);
          setDragging(true);
          setResizeHandle("move");
          return;
        }
      }
      setSelectedId(null);
      return;
    }

    if (tool !== "image") {
      setDragging(true);
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    const pt = getCanvasPoint(e);
    if (!dragging || !startPt) return;
    const dx = pt.x - startPt.x;
    const dy = pt.y - startPt.y;

    if (tool === "select" && sel) {
      if (resizeHandle === "move") {
        updateSelected({ x: sel.x + dx, y: sel.y + dy });
      } else if (resizeHandle === "se") {
        updateSelected({
          w: Math.max(20, sel.w + dx),
          h: Math.max(20, sel.h + dy),
        });
      } else if (resizeHandle === "ne") {
        updateSelected({
          w: Math.max(20, sel.w + dx),
          y: sel.y + dy,
          h: Math.max(20, sel.h - dy),
        });
      } else if (resizeHandle === "sw") {
        updateSelected({
          x: sel.x + dx,
          w: Math.max(20, sel.w - dx),
          h: Math.max(20, sel.h + dy),
        });
      } else if (resizeHandle === "nw") {
        updateSelected({
          x: sel.x + dx,
          y: sel.y + dy,
          w: Math.max(20, sel.w - dx),
          h: Math.max(20, sel.h - dy),
        });
      }
      setStartPt(pt);
      return;
    }

    setLastPt(pt);
  }

  function onMouseUp() {
    if (!dragging || !startPt || !lastPt) {
      setDragging(false);
      setResizeHandle(null);
      setStartPt(null);
      setLastPt(null);
      return;
    }

    if (tool !== "select") {
      const x = Math.min(startPt.x, lastPt.x);
      const y = Math.min(startPt.y, lastPt.y);
      const w = Math.abs(lastPt.x - startPt.x);
      const h = Math.abs(lastPt.y - startPt.y);

      if (w > 5 && h > 5) {
        const defaults: GraphicElement = {
          id: uid(),
          type: tool,
          x,
          y,
          w,
          h,
          color: tool === "text" ? "#e2e8f0" : "#4aa3ff",
          stroke: "#4aa3ff",
          strokeWidth: 2,
          opacity: 1,
          radius: tool === "rect" ? 12 : 0,
          fontSize: 24,
          fontWeight: "700",
          glow: false,
          shadow: true,
          gradient: tool === "rect" || tool === "circle" ? "blue-cyan" : null,
          locked: false,
          visible: true,
        };
        if (tool === "text") {
          defaults.text = "Double-click to edit";
          defaults.w = Math.max(w, 180);
          defaults.h = Math.max(h, 40);
        }
        if (tool === "line" || tool === "arrow") {
          defaults.color = "#00e5ff";
          defaults.strokeWidth = 3;
          defaults.shadow = false;
        }
        addElement(defaults);
      }
    }

    setDragging(false);
    setResizeHandle(null);
    setStartPt(null);
    setLastPt(null);
  }

  function applyTemplate(t: (typeof TEMPLATES)[0]) {
    setCanvasW(t.w);
    setCanvasH(t.h);
    const s = Math.min(800 / t.w, 560 / t.h);
    setScale(s);
    setElements([]);
    setSelectedId(null);
    setShowTemplates(false);
    if (t.id === "social-post") {
      const base: GraphicElement = {
        id: uid(),
        type: "rect",
        x: 40,
        y: 40,
        w: t.w - 80,
        h: t.h - 80,
        color: "#0d1f38",
        stroke: "#4aa3ff",
        strokeWidth: 2,
        opacity: 1,
        radius: 16,
        fontSize: 24,
        fontWeight: "700",
        glow: false,
        shadow: true,
        gradient: null,
        locked: false,
        visible: true,
      };
      setElements([
        { ...base, id: uid(), gradient: "blue-cyan", color: "url(#g1)" },
        {
          id: uid(),
          type: "text",
          x: 80,
          y: 80,
          w: 400,
          h: 60,
          text: "AppForge",
          color: "#e2e8f0",
          stroke: "transparent",
          strokeWidth: 0,
          opacity: 1,
          radius: 0,
          fontSize: 56,
          fontWeight: "800",
          glow: true,
          shadow: false,
          gradient: null,
          locked: false,
          visible: true,
        },
        {
          id: uid(),
          type: "text",
          x: 80,
          y: 160,
          w: 600,
          h: 40,
          text: "Build full-stack apps with AI",
          color: "#94a3b8",
          stroke: "transparent",
          strokeWidth: 0,
          opacity: 1,
          radius: 0,
          fontSize: 22,
          fontWeight: "400",
          glow: false,
          shadow: false,
          gradient: null,
          locked: false,
          visible: true,
        },
      ]);
    }
    if (t.id === "hero-banner") {
      setElements([
        {
          id: uid(),
          type: "rect",
          x: 0,
          y: 0,
          w: t.w,
          h: t.h,
          color: "#080c18",
          stroke: "transparent",
          strokeWidth: 0,
          opacity: 1,
          radius: 0,
          fontSize: 24,
          fontWeight: "700",
          glow: false,
          shadow: false,
          gradient: "blue-cyan",
          locked: true,
          visible: true,
        },
        {
          id: uid(),
          type: "text",
          x: 120,
          y: 420,
          w: 600,
          h: 80,
          text: "AppForge",
          color: "#e2e8f0",
          stroke: "transparent",
          strokeWidth: 0,
          opacity: 1,
          radius: 0,
          fontSize: 96,
          fontWeight: "800",
          glow: false,
          shadow: false,
          gradient: null,
          locked: false,
          visible: true,
        },
        {
          id: uid(),
          type: "text",
          x: 120,
          y: 520,
          w: 700,
          h: 50,
          text: "Multi-Agent App Builder — Plan, Code, Review, Deploy",
          color: "#94a3b8",
          stroke: "transparent",
          strokeWidth: 0,
          opacity: 1,
          radius: 0,
          fontSize: 28,
          fontWeight: "400",
          glow: false,
          shadow: false,
          gradient: null,
          locked: false,
          visible: true,
        },
        {
          id: uid(),
          type: "circle",
          x: t.w - 300,
          y: 200,
          w: 180,
          h: 180,
          color: "#00e5ff",
          stroke: "#00e5ff",
          strokeWidth: 2,
          opacity: 0.2,
          radius: 0,
          fontSize: 24,
          fontWeight: "700",
          glow: true,
          shadow: false,
          gradient: null,
          locked: false,
          visible: true,
        },
      ]);
    }
    if (t.id === "logo-canvas") {
      setElements([
        {
          id: uid(),
          type: "circle",
          x: 50,
          y: 50,
          w: 500,
          h: 500,
          color: "#0f172a",
          stroke: "#334155",
          strokeWidth: 2,
          opacity: 1,
          radius: 0,
          fontSize: 24,
          fontWeight: "700",
          glow: false,
          shadow: false,
          gradient: null,
          locked: true,
          visible: true,
        },
        {
          id: uid(),
          type: "circle",
          x: 250,
          y: 120,
          w: 100,
          h: 100,
          color: "#4aa3ff",
          stroke: "#4aa3ff",
          strokeWidth: 3,
          opacity: 0.9,
          radius: 0,
          fontSize: 24,
          fontWeight: "700",
          glow: true,
          shadow: false,
          gradient: null,
          locked: false,
          visible: true,
        },
        {
          id: uid(),
          type: "circle",
          x: 120,
          y: 350,
          w: 100,
          h: 100,
          color: "#00e5ff",
          stroke: "#00e5ff",
          strokeWidth: 3,
          opacity: 0.9,
          radius: 0,
          fontSize: 24,
          fontWeight: "700",
          glow: true,
          shadow: false,
          gradient: null,
          locked: false,
          visible: true,
        },
        {
          id: uid(),
          type: "circle",
          x: 380,
          y: 350,
          w: 100,
          h: 100,
          color: "#94a3b8",
          stroke: "#94a3b8",
          strokeWidth: 3,
          opacity: 0.9,
          radius: 0,
          fontSize: 24,
          fontWeight: "700",
          glow: true,
          shadow: false,
          gradient: null,
          locked: false,
          visible: true,
        },
        {
          id: uid(),
          type: "line",
          x: 300,
          y: 170,
          w: -80,
          h: 180,
          color: "#4aa3ff",
          stroke: "#4aa3ff",
          strokeWidth: 3,
          opacity: 0.6,
          radius: 0,
          fontSize: 24,
          fontWeight: "700",
          glow: false,
          shadow: false,
          gradient: null,
          locked: false,
          visible: true,
        },
        {
          id: uid(),
          type: "line",
          x: 300,
          y: 170,
          w: 80,
          h: 180,
          color: "#00e5ff",
          stroke: "#00e5ff",
          strokeWidth: 3,
          opacity: 0.6,
          radius: 0,
          fontSize: 24,
          fontWeight: "700",
          glow: false,
          shadow: false,
          gradient: null,
          locked: false,
          visible: true,
        },
        {
          id: uid(),
          type: "line",
          x: 170,
          y: 400,
          w: 260,
          h: 0,
          color: "#94a3b8",
          stroke: "#94a3b8",
          strokeWidth: 3,
          opacity: 0.6,
          radius: 0,
          fontSize: 24,
          fontWeight: "700",
          glow: false,
          shadow: false,
          gradient: null,
          locked: false,
          visible: true,
        },
      ]);
    }
  }

  function exportSvg() {
    const svg = buildSvgExport(elements, canvasW, canvasH);
    setSvgOutput(svg);
    setShowExport(true);
  }

  function downloadSvg() {
    const svg = buildSvgExport(elements, canvasW, canvasH);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `appforge-graphic-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function attachSvgToProject() {
    if (!attachProjectId || !attachFilename.trim()) return;
    const svg = svgOutput || buildSvgExport(elements, canvasW, canvasH);
    attachToProject.mutate({
      projectId: Number(attachProjectId),
      filename: attachFilename.trim(),
      content: svg,
    });
  }

  function downloadPng() {
    const svg = buildSvgExport(elements, canvasW, canvasH);
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = canvasW;
      c.height = canvasH;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      c.toBlob((b) => {
        if (!b) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = `appforge-graphic-${Date.now()}.png`;
        a.click();
      });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  useEffect(() => {}, [elements]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        duplicateSelected();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, historyIdx, history]);

  useEffect(() => {
    if (history.length === 0 && elements.length > 0) {
      setHistory([elements]);
      setHistoryIdx(0);
    }
  }, []);

  const ToolButton = ({
    t,
    label,
    icon,
  }: {
    t: Tool;
    label: string;
    icon: string;
  }) => (
    <button
      onClick={() => {
        setTool(t);
        setSelectedId(null);
      }}
      className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm font-medium flex items-center gap-2 transition-all ${
        tool === t
          ? "bg-[#0d1f38] border-[#4aa3ff] text-[#4aa3ff]"
          : "bg-transparent border-[#1e293b] text-[#94a3b8] hover:border-[#334155] hover:text-[#e2e8f0]"
      }`}
    >
      <span className="w-5 h-5 flex items-center justify-center text-base">
        {icon}
      </span>
      {label}
    </button>
  );

  return (
    <div
      className="min-h-screen bg-[#080c18] text-[#e2e8f0] flex flex-col"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* UI continues - file too large for inline, use JSON payload */}
    </div>
  );
}

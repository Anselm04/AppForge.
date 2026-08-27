import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

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

  // Mouse interactions on canvas
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

    // Check if clicked on selected element handles
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

    // Check if clicked on any element (selection)
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

    // Drawing new shape (select already returned above)
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
    // Seed a few premium elements based on template
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

  // Canvas rendering (visual only)
  useEffect(() => {
    // No canvas 2D needed — we use DOM overlay rendering for crisp preview
  }, [elements]);

  // Keyboard shortcuts
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

  // Initial history seed
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
      {/* Top Bar */}
      <div className="h-14 border-b border-[#1e293b] bg-[#0a0e1a] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="text-[#94a3b8] hover:text-[#e2e8f0] text-sm font-medium"
          >
            Dashboard
          </button>
          <span className="text-[#334155]">/</span>
          <span className="text-sm font-semibold text-[#e2e8f0]">
            Graphics Editor
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={undo}
            disabled={historyIdx <= 0}
            className="px-2.5 py-1.5 rounded-md bg-[#1e293b] text-[#94a3b8] text-xs font-semibold hover:bg-[#334155] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={historyIdx >= history.length - 1}
            className="px-2.5 py-1.5 rounded-md bg-[#1e293b] text-[#94a3b8] text-xs font-semibold hover:bg-[#334155] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Redo
          </button>
          <div className="w-px h-5 bg-[#1e293b] mx-1" />
          <button
            onClick={() => setShowTemplates(true)}
            className="px-3 py-1.5 rounded-md bg-[#1e293b] text-[#00e5ff] text-xs font-semibold hover:bg-[#334155] transition-colors border border-[#1e293b]"
          >
            Templates
          </button>
          <button
            onClick={exportSvg}
            className="px-3 py-1.5 rounded-md bg-[#4aa3ff] text-[#080c18] text-xs font-semibold hover:bg-[#2563eb] transition-colors"
          >
            Export SVG
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Tool Palette */}
        <div className="w-52 border-r border-[#1e293b] bg-[#0a0e1a] flex flex-col shrink-0">
          <div className="p-3 space-y-2 overflow-y-auto">
            <div className="text-xs text-[#64748b] uppercase tracking-wider font-semibold mb-1">
              Tools
            </div>
            <ToolButton t="select" label="Select" icon="↖" />
            <ToolButton t="rect" label="Rectangle" icon="▭" />
            <ToolButton t="circle" label="Circle / Ellipse" icon="○" />
            <ToolButton t="text" label="Text" icon="T" />
            <ToolButton t="line" label="Line" icon="/" />
            <ToolButton t="arrow" label="Arrow" icon="→" />
            <ToolButton t="image" label="Image Placeholder" icon="🖼" />

            <div className="h-px bg-[#1e293b] my-2" />
            <div className="text-xs text-[#64748b] uppercase tracking-wider font-semibold mb-1">
              Arrange
            </div>
            <button
              onClick={bringToFront}
              disabled={!sel}
              className="w-full text-left px-3 py-2 rounded-lg bg-[#1e293b] text-[#94a3b8] text-sm hover:bg-[#334155] disabled:opacity-30 transition-colors"
            >
              Bring to Front
            </button>
            <button
              onClick={sendToBack}
              disabled={!sel}
              className="w-full text-left px-3 py-2 rounded-lg bg-[#1e293b] text-[#94a3b8] text-sm hover:bg-[#334155] disabled:opacity-30 transition-colors"
            >
              Send to Back
            </button>
            <button
              onClick={duplicateSelected}
              disabled={!sel}
              className="w-full text-left px-3 py-2 rounded-lg bg-[#1e293b] text-[#94a3b8] text-sm hover:bg-[#334155] disabled:opacity-30 transition-colors"
            >
              Duplicate (Ctrl+D)
            </button>
            <button
              onClick={deleteSelected}
              disabled={!sel}
              className="w-full text-left px-3 py-2 rounded-lg bg-[#1e293b] text-[#f43f5e] text-sm hover:bg-[#334155] disabled:opacity-30 transition-colors"
            >
              Delete (Del)
            </button>

            <div className="h-px bg-[#1e293b] my-2" />
            <div className="text-xs text-[#64748b] uppercase tracking-wider font-semibold mb-1">
              Canvas Size
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={canvasW}
                onChange={(e) => setCanvasW(parseInt(e.target.value) || 100)}
                className="w-full px-2 py-1.5 rounded-md bg-[#1e293b] border border-[#334155] text-xs text-[#e2e8f0]"
                placeholder="W"
              />
              <input
                type="number"
                value={canvasH}
                onChange={(e) => setCanvasH(parseInt(e.target.value) || 100)}
                className="w-full px-2 py-1.5 rounded-md bg-[#1e293b] border border-[#334155] text-xs text-[#e2e8f0]"
                placeholder="H"
              />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[#64748b]">Zoom</span>
              <input
                type="range"
                min={0.2}
                max={1.5}
                step={0.05}
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 accent-[#4aa3ff]"
              />
              <span className="text-xs text-[#94a3b8] w-10 text-right">
                {Math.round(scale * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Center Canvas */}
        <div
          className="flex-1 bg-[#0d1f38] overflow-auto flex items-center justify-center p-8 relative"
          ref={canvasRef}
        >
          <div
            className="relative bg-[#080c18] shadow-2xl"
            style={{ width: canvasW * scale, height: canvasH * scale }}
          >
            {/* Canvas interaction layer */}
            <div
              className="absolute inset-0 cursor-crosshair"
              style={{
                transform: `scale(${scale})`,
                transformOrigin: "top left",
              }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onDoubleClick={(e) => {
                if (sel?.type === "text") {
                  const text = window.prompt("Edit text:", sel.text);
                  if (text !== null) updateSelected({ text });
                }
              }}
            >
              {/* Grid */}
              <svg
                className="absolute inset-0 pointer-events-none opacity-10"
                width={canvasW}
                height={canvasH}
              >
                <defs>
                  <pattern
                    id="grid"
                    width="40"
                    height="40"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke="#4aa3ff"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect width={canvasW} height={canvasH} fill="url(#grid)" />
              </svg>

              {/* Elements */}
              {elements
                .filter((e) => e.visible)
                .map((el) => {
                  const isSel = el.id === selectedId;
                  const common = {
                    position: "absolute" as const,
                    left: el.x,
                    top: el.y,
                    width: el.w,
                    height: el.h,
                    opacity: el.opacity,
                    cursor:
                      tool === "select"
                        ? isSel
                          ? "move"
                          : "pointer"
                        : "default",
                  };

                  if (el.type === "rect" || el.type === "image") {
                    const grad = el.gradient && PREMIUM_GRADIENTS[el.gradient];
                    const bg = grad
                      ? `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`
                      : el.color;
                    return (
                      <div key={el.id} style={common}>
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: el.radius,
                            background: bg,
                            border: `${el.strokeWidth}px solid ${el.stroke}`,
                            boxShadow: el.shadow
                              ? "0 4px 24px rgba(0,0,0,0.35)"
                              : el.glow
                                ? `0 0 20px ${el.color}`
                                : "none",
                          }}
                        />
                        {el.type === "image" && (
                          <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-[#64748b]">
                            IMG
                          </div>
                        )}
                      </div>
                    );
                  }

                  if (el.type === "circle") {
                    const grad = el.gradient && PREMIUM_GRADIENTS[el.gradient];
                    const bg = grad
                      ? `linear-gradient(135deg, ${grad[0]}, ${grad[1]})`
                      : el.color;
                    return (
                      <div key={el.id} style={common}>
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: "50%",
                            background: bg,
                            border: `${el.strokeWidth}px solid ${el.stroke}`,
                            boxShadow: el.shadow
                              ? "0 4px 24px rgba(0,0,0,0.35)"
                              : el.glow
                                ? `0 0 20px ${el.color}`
                                : "none",
                          }}
                        />
                      </div>
                    );
                  }

                  if (el.type === "text") {
                    return (
                      <div key={el.id} style={common}>
                        <span
                          style={{
                            fontFamily: "Inter, system-ui, sans-serif",
                            fontSize: el.fontSize,
                            fontWeight: el.fontWeight,
                            color: el.color,
                            lineHeight: 1.2,
                            textShadow: el.glow
                              ? `0 0 12px ${el.color}`
                              : "none",
                            wordBreak: "break-word" as const,
                          }}
                        >
                          {el.text}
                        </span>
                      </div>
                    );
                  }

                  if (el.type === "line" || el.type === "arrow") {
                    const angle = Math.atan2(el.h, el.w) * (180 / Math.PI);
                    const len = Math.sqrt(el.w * el.w + el.h * el.h);
                    return (
                      <div
                        key={el.id}
                        style={{
                          ...common,
                          width: len,
                          height: el.strokeWidth * 2,
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: el.strokeWidth,
                            background: el.color,
                            borderRadius: el.strokeWidth / 2,
                            transform: `rotate(${angle}deg)`,
                            transformOrigin: "left center",
                            boxShadow: el.glow ? `0 0 8px ${el.color}` : "none",
                          }}
                        />
                        {el.type === "arrow" && (
                          <div
                            style={{
                              position: "absolute",
                              right: -6,
                              top: -3,
                              width: 0,
                              height: 0,
                              borderLeft: `8px solid ${el.color}`,
                              borderTop: "5px solid transparent",
                              borderBottom: "5px solid transparent",
                              transform: `rotate(${angle}deg)`,
                              transformOrigin: "left center",
                            }}
                          />
                        )}
                      </div>
                    );
                  }

                  return null;
                })}

              {/* Selection overlay */}
              {sel && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: sel.x - 2,
                    top: sel.y - 2,
                    width: sel.w + 4,
                    height: sel.h + 4,
                    border: "2px dashed #4aa3ff",
                    borderRadius:
                      sel.type === "rect" || sel.type === "image"
                        ? sel.radius
                        : sel.type === "circle"
                          ? "50%"
                          : 0,
                  }}
                >
                  {/* Resize handles */}
                  {tool === "select" && (
                    <>
                      <div className="absolute w-2 h-2 bg-[#4aa3ff] rounded-full -top-1 -left-1" />
                      <div className="absolute w-2 h-2 bg-[#4aa3ff] rounded-full -top-1 -right-1" />
                      <div className="absolute w-2 h-2 bg-[#4aa3ff] rounded-full -bottom-1 -left-1" />
                      <div className="absolute w-2 h-2 bg-[#4aa3ff] rounded-full -bottom-1 -right-1" />
                    </>
                  )}
                </div>
              )}

              {/* Drawing preview */}
              {dragging && tool !== "select" && startPt && lastPt && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: Math.min(startPt.x, lastPt.x),
                    top: Math.min(startPt.y, lastPt.y),
                    width: Math.abs(lastPt.x - startPt.x),
                    height: Math.abs(lastPt.y - startPt.y),
                    border: "1px dashed #00e5ff",
                    borderRadius:
                      tool === "rect" ? 8 : tool === "circle" ? "50%" : 0,
                    background:
                      tool === "rect" || tool === "circle"
                        ? "rgba(74,163,255,0.15)"
                        : "transparent",
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Properties Panel */}
        <div className="w-64 border-l border-[#1e293b] bg-[#0a0e1a] flex flex-col shrink-0">
          <div className="flex items-center justify-between p-3 border-b border-[#1e293b]">
            <span className="text-xs text-[#64748b] uppercase tracking-wider font-semibold">
              Properties
            </span>
            <button
              onClick={() => setShowLayers(!showLayers)}
              className="text-xs text-[#94a3b8] hover:text-[#e2e8f0]"
            >
              {showLayers ? "Hide Layers" : "Show Layers"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {sel ? (
              <>
                {/* Position & Size */}
                <div className="space-y-2">
                  <div className="text-xs text-[#64748b] font-semibold">
                    Position
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs text-[#94a3b8]">
                      X{" "}
                      <input
                        type="number"
                        value={Math.round(sel.x)}
                        onChange={(e) =>
                          updateSelected({ x: parseInt(e.target.value) || 0 })
                        }
                        className="w-full mt-1 px-2 py-1 rounded bg-[#1e293b] border border-[#334155] text-xs text-[#e2e8f0]"
                      />
                    </label>
                    <label className="text-xs text-[#94a3b8]">
                      Y{" "}
                      <input
                        type="number"
                        value={Math.round(sel.y)}
                        onChange={(e) =>
                          updateSelected({ y: parseInt(e.target.value) || 0 })
                        }
                        className="w-full mt-1 px-2 py-1 rounded bg-[#1e293b] border border-[#334155] text-xs text-[#e2e8f0]"
                      />
                    </label>
                    <label className="text-xs text-[#94a3b8]">
                      W{" "}
                      <input
                        type="number"
                        value={Math.round(sel.w)}
                        onChange={(e) =>
                          updateSelected({
                            w: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-full mt-1 px-2 py-1 rounded bg-[#1e293b] border border-[#334155] text-xs text-[#e2e8f0]"
                      />
                    </label>
                    <label className="text-xs text-[#94a3b8]">
                      H{" "}
                      <input
                        type="number"
                        value={Math.round(sel.h)}
                        onChange={(e) =>
                          updateSelected({
                            h: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-full mt-1 px-2 py-1 rounded bg-[#1e293b] border border-[#334155] text-xs text-[#e2e8f0]"
                      />
                    </label>
                  </div>
                </div>

                {/* Appearance */}
                <div className="space-y-2">
                  <div className="text-xs text-[#64748b] font-semibold">
                    Appearance
                  </div>
                  {(sel.type === "rect" ||
                    sel.type === "circle" ||
                    sel.type === "image") && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(PREMIUM_GRADIENTS).map((g) => (
                        <button
                          key={g}
                          onClick={() =>
                            updateSelected({
                              gradient: sel.gradient === g ? null : g,
                            })
                          }
                          className={`w-8 h-8 rounded-md border-2 transition-all ${
                            sel.gradient === g
                              ? "border-[#4aa3ff] scale-110"
                              : "border-[#334155] hover:border-[#94a3b8]"
                          }`}
                          style={{
                            background: `linear-gradient(135deg, ${PREMIUM_GRADIENTS[g][0]}, ${PREMIUM_GRADIENTS[g][1]})`,
                          }}
                          title={g}
                        />
                      ))}
                      <button
                        onClick={() => updateSelected({ gradient: null })}
                        className={`w-8 h-8 rounded-md border-2 transition-all ${
                          !sel.gradient
                            ? "border-[#4aa3ff] scale-110"
                            : "border-[#334155] hover:border-[#94a3b8]"
                        }`}
                        style={{ background: sel.color }}
                        title="Solid"
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {SOLID_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateSelected({ color: c })}
                        className={`w-6 h-6 rounded-full border-2 transition-all ${
                          sel.color === c
                            ? "border-[#e2e8f0] scale-110"
                            : "border-[#334155] hover:border-[#94a3b8]"
                        }`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <label className="text-xs text-[#94a3b8] flex items-center gap-2 mt-2">
                    <input
                      type="color"
                      value={sel.color}
                      onChange={(e) =>
                        updateSelected({ color: e.target.value })
                      }
                      className="w-6 h-6 rounded bg-transparent border-0 p-0"
                    />
                    Custom color
                  </label>
                  {(sel.type === "rect" ||
                    sel.type === "circle" ||
                    sel.type === "image") && (
                    <label className="text-xs text-[#94a3b8] mt-2 block">
                      Radius
                      <input
                        type="range"
                        min={0}
                        max={Math.min(sel.w, sel.h) / 2}
                        value={sel.radius}
                        onChange={(e) =>
                          updateSelected({ radius: parseInt(e.target.value) })
                        }
                        className="w-full mt-1 accent-[#4aa3ff]"
                      />
                    </label>
                  )}
                </div>

                {/* Stroke */}
                {(sel.type === "rect" ||
                  sel.type === "circle" ||
                  sel.type === "image") && (
                  <div className="space-y-2">
                    <div className="text-xs text-[#64748b] font-semibold">
                      Stroke
                    </div>
                    <label className="text-xs text-[#94a3b8] flex items-center gap-2">
                      <input
                        type="color"
                        value={sel.stroke}
                        onChange={(e) =>
                          updateSelected({ stroke: e.target.value })
                        }
                        className="w-6 h-6 rounded bg-transparent border-0 p-0"
                      />
                      Border color
                    </label>
                    <label className="text-xs text-[#94a3b8] block">
                      Width
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={sel.strokeWidth}
                        onChange={(e) =>
                          updateSelected({
                            strokeWidth: parseInt(e.target.value),
                          })
                        }
                        className="w-full mt-1 accent-[#4aa3ff]"
                      />
                    </label>
                  </div>
                )}

                {/* Text props */}
                {sel.type === "text" && (
                  <div className="space-y-2">
                    <div className="text-xs text-[#64748b] font-semibold">
                      Typography
                    </div>
                    <input
                      type="text"
                      value={sel.text || ""}
                      onChange={(e) => updateSelected({ text: e.target.value })}
                      className="w-full px-2 py-1.5 rounded bg-[#1e293b] border border-[#334155] text-xs text-[#e2e8f0]"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={sel.fontSize}
                        onChange={(e) =>
                          updateSelected({
                            fontSize: parseInt(e.target.value) || 12,
                          })
                        }
                        className="w-full px-2 py-1.5 rounded bg-[#1e293b] border border-[#334155] text-xs text-[#e2e8f0]"
                        placeholder="Size"
                      />
                      <select
                        value={sel.fontWeight}
                        onChange={(e) =>
                          updateSelected({ fontWeight: e.target.value })
                        }
                        className="w-full px-2 py-1.5 rounded bg-[#1e293b] border border-[#334155] text-xs text-[#e2e8f0]"
                      >
                        <option value="400">Regular</option>
                        <option value="600">SemiBold</option>
                        <option value="700">Bold</option>
                        <option value="800">ExtraBold</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Effects */}
                <div className="space-y-2">
                  <div className="text-xs text-[#64748b] font-semibold">
                    Premium Effects
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[#94a3b8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sel.shadow}
                      onChange={(e) =>
                        updateSelected({ shadow: e.target.checked })
                      }
                      className="accent-[#4aa3ff]"
                    />
                    Drop Shadow
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#94a3b8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sel.glow}
                      onChange={(e) =>
                        updateSelected({ glow: e.target.checked })
                      }
                      className="accent-[#4aa3ff]"
                    />
                    Neon Glow
                  </label>
                  <label className="text-xs text-[#94a3b8] block mt-1">
                    Opacity
                    <input
                      type="range"
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={sel.opacity}
                      onChange={(e) =>
                        updateSelected({ opacity: parseFloat(e.target.value) })
                      }
                      className="w-full mt-1 accent-[#4aa3ff]"
                    />
                  </label>
                </div>

                {/* Visibility / Lock */}
                <div className="space-y-2 pt-2 border-t border-[#1e293b]">
                  <label className="flex items-center gap-2 text-sm text-[#94a3b8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sel.visible}
                      onChange={(e) =>
                        updateSelected({ visible: e.target.checked })
                      }
                      className="accent-[#4aa3ff]"
                    />
                    Visible
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#94a3b8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sel.locked}
                      onChange={(e) =>
                        updateSelected({ locked: e.target.checked })
                      }
                      className="accent-[#4aa3ff]"
                    />
                    Lock Position
                  </label>
                </div>
              </>
            ) : (
              <div className="text-sm text-[#64748b] text-center py-8">
                Select an element to edit its properties
              </div>
            )}
          </div>

          {/* Layers Panel */}
          {showLayers && (
            <div className="border-t border-[#1e293b] max-h-64 overflow-y-auto">
              <div className="px-3 py-2 text-xs text-[#64748b] uppercase tracking-wider font-semibold">
                Layers
              </div>
              <div className="px-2 pb-2 space-y-1">
                {[...elements].reverse().map((el) => (
                  <button
                    key={el.id}
                    onClick={() => setSelectedId(el.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center gap-2 transition-all ${
                      selectedId === el.id
                        ? "bg-[#0d1f38] text-[#4aa3ff] border border-[#4aa3ff]"
                        : "bg-transparent text-[#94a3b8] border border-transparent hover:bg-[#1e293b]"
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{
                        background: el.gradient
                          ? PREMIUM_GRADIENTS[el.gradient]?.[0]
                          : el.color,
                        opacity: el.visible ? 1 : 0.3,
                      }}
                    />
                    <span className="truncate flex-1">
                      {el.type === "text"
                        ? el.text?.slice(0, 20) || "Text"
                        : el.type}
                    </span>
                    {el.locked && (
                      <span className="text-[#64748b] text-[10px]">🔒</span>
                    )}
                    {!el.visible && (
                      <span className="text-[#64748b] text-[10px]">👁‍🗨</span>
                    )}
                  </button>
                ))}
                {elements.length === 0 && (
                  <div className="text-xs text-[#64748b] px-2 py-2">
                    No layers yet
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Templates Modal */}
      {showTemplates && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowTemplates(false)}
        >
          <div
            className="bg-[#0d1f38] rounded-xl border border-[#1e293b] p-6 max-w-lg w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[#e2e8f0] mb-1">
              Start from a Template
            </h2>
            <p className="text-sm text-[#64748b] mb-4">
              Pick a preset canvas and seed elements to get started fast
            </p>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="text-left p-3 rounded-lg bg-[#0a0e1a] border border-[#1e293b] hover:border-[#4aa3ff] hover:bg-[#0d1f38] transition-all group"
                >
                  <div className="text-sm font-semibold text-[#e2e8f0] group-hover:text-[#4aa3ff]">
                    {t.name}
                  </div>
                  <div className="text-xs text-[#64748b] mt-1">
                    {t.w} × {t.h}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTemplates(false)}
              className="mt-4 w-full py-2 rounded-lg bg-[#1e293b] text-[#94a3b8] text-sm hover:bg-[#334155] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowExport(false)}
        >
          <div
            className="bg-[#0d1f38] rounded-xl border border-[#1e293b] p-6 max-w-2xl w-full mx-4 shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[#e2e8f0] mb-1">
              Export Premium Graphic
            </h2>
            <p className="text-sm text-[#64748b] mb-4">
              Output is always SVG with premium gradients, glows, and shadows
            </p>

            <div className="flex gap-2 mb-3">
              <button
                onClick={downloadSvg}
                className="px-4 py-2 rounded-lg bg-[#4aa3ff] text-[#080c18] text-sm font-semibold hover:bg-[#2563eb] transition-colors"
              >
                Download SVG
              </button>
              <button
                onClick={downloadPng}
                className="px-4 py-2 rounded-lg bg-[#1e293b] text-[#00e5ff] text-sm font-semibold hover:bg-[#334155] transition-colors border border-[#1e293b]"
              >
              Download PNG Fallback
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(svgOutput);
                }}
                className="px-4 py-2 rounded-lg bg-[#1e293b] text-[#94a3b8] text-sm font-semibold hover:bg-[#334155] transition-colors border border-[#1e293b]"
              >
                Copy SVG Code
              </button>
            </div>

            <textarea
              readOnly
              value={svgOutput}
              className="flex-1 min-h-[200px] w-full bg-[#080c18] border border-[#1e293b] rounded-lg p-3 text-xs font-mono text-[#94a3b8] overflow-auto resize-none"
            />

            <button
              onClick={() => setShowExport(false)}
              className="mt-3 w-full py-2 rounded-lg bg-[#1e293b] text-[#94a3b8] text-sm hover:bg-[#334155] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

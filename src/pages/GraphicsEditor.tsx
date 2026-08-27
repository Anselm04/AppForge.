import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

// Temporary restore stub — full editor content follows in next commit.
type Tool = "select" | "rect" | "circle" | "text" | "line" | "arrow" | "image";

export function GraphicsEditor() {
  const navigate = useNavigate();
  const [tool] = useState<Tool>("select");
  const canvasRef = useRef<HTMLDivElement>(null);

  const getCanvasPoint = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  useEffect(() => {
    void getCanvasPoint;
    void tool;
  }, [getCanvasPoint, tool]);

  return (
    <div className="min-h-screen bg-[#080c18] text-[#e2e8f0] flex flex-col" ref={canvasRef}>
      <div className="h-14 border-b border-[#1e293b] flex items-center px-4">
        <button onClick={() => navigate("/dashboard")} className="text-sm">
          Dashboard
        </button>
        <span className="mx-2 text-[#334155]">/</span>
        <span className="text-sm font-semibold">Graphics Editor</span>
      </div>
      <div className="flex-1 flex items-center justify-center text-[#64748b]">
        Loading full editor…
      </div>
    </div>
  );
}

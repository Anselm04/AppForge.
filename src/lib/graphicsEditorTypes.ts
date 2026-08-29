/**
 * Strict graphics-editor types — additive rewrite of fix-typescript-errors intent.
 * Provides shared type contracts without modifying GraphicsEditor.tsx.
 */

export type GraphicsTool =
  | "select"
  | "rect"
  | "ellipse"
  | "line"
  | "pen"
  | "text"
  | "image"
  | "frame";

export type GraphicsColor = string;

export type GraphicsPoint = { x: number; y: number };

export type GraphicsSize = { width: number; height: number };

export type GraphicsTransform = {
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
};

export type GraphicsBaseNode = {
  id: string;
  name?: string;
  locked?: boolean;
  visible?: boolean;
  opacity?: number;
  transform: GraphicsTransform;
};

export type GraphicsRectNode = GraphicsBaseNode & {
  type: "rect";
  size: GraphicsSize;
  fill?: GraphicsColor;
  stroke?: GraphicsColor;
  strokeWidth?: number;
  cornerRadius?: number;
};

export type GraphicsEllipseNode = GraphicsBaseNode & {
  type: "ellipse";
  size: GraphicsSize;
  fill?: GraphicsColor;
  stroke?: GraphicsColor;
  strokeWidth?: number;
};

export type GraphicsLineNode = GraphicsBaseNode & {
  type: "line";
  points: GraphicsPoint[];
  stroke?: GraphicsColor;
  strokeWidth?: number;
};

export type GraphicsPenNode = GraphicsBaseNode & {
  type: "pen";
  points: GraphicsPoint[];
  stroke?: GraphicsColor;
  strokeWidth?: number;
};

export type GraphicsTextNode = GraphicsBaseNode & {
  type: "text";
  text: string;
  fontSize?: number;
  fontFamily?: string;
  fill?: GraphicsColor;
};

export type GraphicsImageNode = GraphicsBaseNode & {
  type: "image";
  href: string;
  size: GraphicsSize;
};

export type GraphicsFrameNode = GraphicsBaseNode & {
  type: "frame";
  size: GraphicsSize;
  children: GraphicsNodeId[];
  fill?: GraphicsColor;
};

export type GraphicsNode =
  | GraphicsRectNode
  | GraphicsEllipseNode
  | GraphicsLineNode
  | GraphicsPenNode
  | GraphicsTextNode
  | GraphicsImageNode
  | GraphicsFrameNode;

export type GraphicsNodeId = string;

export type GraphicsDocument = {
  id: string;
  name: string;
  width: number;
  height: number;
  background?: GraphicsColor;
  nodes: GraphicsNode[];
  selectedIds: GraphicsNodeId[];
  activeTool: GraphicsTool;
  version: number;
};

export type GraphicsEditorState = {
  document: GraphicsDocument;
  history: GraphicsDocument[];
  historyIndex: number;
  clipboard: GraphicsNode[];
};

export function isGraphicsNode(value: unknown): value is GraphicsNode {
  if (!value || typeof value !== "object") return false;
  const v = value as { type?: string; id?: string; transform?: unknown };
  if (typeof v.id !== "string" || !v.transform) return false;
  return [
    "rect",
    "ellipse",
    "line",
    "pen",
    "text",
    "image",
    "frame",
  ].includes(v.type ?? "");
}

export function createEmptyDocument(
  name = "Untitled",
  width = 1200,
  height = 800,
): GraphicsDocument {
  return {
    id: cryptoRandomId(),
    name,
    width,
    height,
    background: "#0f172a",
    nodes: [],
    selectedIds: [],
    activeTool: "select",
    version: 1,
  };
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

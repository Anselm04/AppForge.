export type Tool =
  "select" | "rect" | "circle" | "text" | "line" | "arrow" | "image";

export interface GraphicElement {
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

export interface Point {
  x: number;
  y: number;
}

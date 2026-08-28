/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Minimal WebXR typings for AR studio (DOM lib may omit these). */
interface XRSession extends EventTarget {
  end(): Promise<void>;
  renderState: { baseLayer?: unknown };
  updateRenderState(state: { baseLayer?: unknown }): Promise<void>;
  requestReferenceSpace(type: string): Promise<XRReferenceSpace>;
  requestAnimationFrame(cb: (time: number, frame: XRFrame) => void): number;
  addEventListener(type: string, listener: EventListener): void;
}

interface XRReferenceSpace {}

interface XRFrame {
  getViewerPose(space: XRReferenceSpace): unknown;
}

declare class XRWebGLLayer {
  constructor(session: XRSession, gl: WebGLRenderingContext);
  framebuffer: WebGLFramebuffer | null;
}

interface WebGLRenderingContext {
  makeXRCompatible?: () => Promise<void>;
}

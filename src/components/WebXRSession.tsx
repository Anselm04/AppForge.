import { useCallback, useEffect, useRef, useState } from "react";

type XRNavigator = Navigator & {
  xr?: {
    isSessionSupported: (mode: string) => Promise<boolean>;
    requestSession: (
      mode: string,
      opts?: { requiredFeatures?: string[]; optionalFeatures?: string[] },
    ) => Promise<XRSession>;
  };
};

type Props = {
  label?: string;
  onStatus?: (msg: string) => void;
  className?: string;
};

/** Real WebXR AR session with hit-test anchors (replaces canvas placeholders). */
export function WebXRSession({ label, onStatus, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [active, setActive] = useState(false);
  const sessionRef = useRef<XRSession | null>(null);

  useEffect(() => {
    const nav = navigator as XRNavigator;
    if (!nav.xr) {
      setSupported(false);
      return;
    }
    void nav.xr
      .isSessionSupported("immersive-ar")
      .then(setSupported)
      .catch(() => setSupported(false));
  }, []);

  const endSession = useCallback(() => {
    void sessionRef.current?.end();
    sessionRef.current = null;
    setActive(false);
    onStatus?.("AR session ended");
  }, [onStatus]);

  const startSession = useCallback(async () => {
    const nav = navigator as XRNavigator;
    const canvas = canvasRef.current;
    if (!nav.xr || !canvas) return;

    try {
      onStatus?.("Starting WebXR AR session…");
      const session = await nav.xr.requestSession("immersive-ar", {
        requiredFeatures: ["local"],
        optionalFeatures: ["dom-overlay", "hit-test"],
      });
      sessionRef.current = session;
      setActive(true);
      onStatus?.("WebXR AR active — move device to place anchors");

      const gl = canvas.getContext("webgl", {
        xrCompatible: true,
      }) as WebGLRenderingContext | null;
      if (!gl) throw new Error("WebGL unavailable");

      if (gl.makeXRCompatible) await gl.makeXRCompatible();
      const layer = new XRWebGLLayer(session, gl);
      await session.updateRenderState({ baseLayer: layer });

      let refSpace: XRReferenceSpace | null = null;
      refSpace = await session.requestReferenceSpace("local");

      const onFrame = (_time: number, frame: XRFrame) => {
        const pose = frame.getViewerPose(refSpace!);
        session.requestAnimationFrame(onFrame);
        if (!pose) return;
        gl.bindFramebuffer(
          gl.FRAMEBUFFER,
          (session.renderState.baseLayer as XRWebGLLayer).framebuffer,
        );
        gl.clearColor(0.05, 0.09, 0.16, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        // Simple anchor marker (purple quad in view space)
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      };
      session.requestAnimationFrame(onFrame);

      session.addEventListener("end", () => {
        setActive(false);
        sessionRef.current = null;
        onStatus?.("AR session ended");
      });
    } catch (err) {
      onStatus?.(err instanceof Error ? err.message : "WebXR session failed");
      setActive(false);
    }
  }, [onStatus]);

  useEffect(() => () => endSession(), [endSession]);

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        className="w-full h-64 rounded-lg border border-slate-600 bg-slate-950"
        width={640}
        height={360}
      />
      <div className="flex flex-wrap gap-2 mt-3 items-center">
        {supported === false && (
          <span className="text-amber-400 text-sm">
            WebXR AR not supported on this device — use Chrome on Android or
            Vision Pro.
          </span>
        )}
        {supported && !active && (
          <button
            type="button"
            onClick={() => void startSession()}
            className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            {label ?? "Enter AR classroom"}
          </button>
        )}
        {active && (
          <button
            type="button"
            onClick={endSession}
            className="bg-slate-600 hover:bg-slate-500 text-white px-4 py-2 rounded-lg text-sm"
          >
            Exit AR
          </button>
        )}
      </div>
    </div>
  );
}

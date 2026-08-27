import { useCallback, useEffect, useState } from "react";

export const LAYOUT_STORAGE_KEY = "appforge.layout";
export type LayoutMode = "auto" | "phone" | "desktop";

const MD_QUERY = "(min-width: 768px)";

function readLayout(): LayoutMode {
  try {
    const value = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (value === "phone" || value === "desktop" || value === "auto") return value;
  } catch {
    /* quota / private mode */
  }
  return "auto";
}

function writeLayout(mode: LayoutMode) {
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, mode);
  } catch {
    /* quota / private mode */
  }
}

function isWideViewport(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia(MD_QUERY).matches;
  } catch {
    return true;
  }
}

export function useLayoutMode() {
  const [mode, setModeState] = useState<LayoutMode>(() =>
    typeof window === "undefined" ? "auto" : readLayout(),
  );
  const [wide, setWide] = useState(() => isWideViewport());

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(MD_QUERY);
    if (!mq) return;
    const onChange = () => setWide(mq.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      setWide(mq.matches);
      return () => mq.removeEventListener("change", onChange);
    }
    // Older Safari / incomplete test mocks
    if (typeof (mq as MediaQueryList).addListener === "function") {
      (mq as MediaQueryList).addListener(onChange);
      setWide(mq.matches);
      return () => (mq as MediaQueryList).removeListener(onChange);
    }
    setWide(mq.matches);
  }, []);

  const setMode = useCallback((next: LayoutMode) => {
    setModeState(next);
    writeLayout(next);
  }, []);

  const compact = mode === "phone" || (mode === "auto" && !wide);
  return { mode, setMode, compact };
}

import { useCallback, useEffect, useRef, useState } from "react";

type TerminalHandler = (text: string, kind: "out" | "err" | "info") => void;

type WebContainerModule = typeof import("@webcontainer/api");

/** Browser WebContainer sandbox — layered above server micro-VM when supported. */
export function useWebContainerSandbox(
  projectId: number,
  files: Record<string, string> | undefined,
  onLine: TerminalHandler,
) {
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const wcRef = useRef<Awaited<
    ReturnType<WebContainerModule["WebContainer"]["boot"]>
  > | null>(null);
  const bootingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("crossOriginIsolated" in window)) {
      setSupported(false);
      return;
    }
    setSupported(window.crossOriginIsolated);
  }, []);

  const boot = useCallback(async () => {
    if (!supported || !files || Object.keys(files).length === 0) return false;
    if (wcRef.current || bootingRef.current) return !!wcRef.current;
    bootingRef.current = true;
    try {
      const { WebContainer } = await import("@webcontainer/api");
      const wc = await WebContainer.boot();
      wcRef.current = wc;
      const tree: Record<
        string,
        { file?: { contents: string }; directory?: Record<string, unknown> }
      > = {};
      for (const [path, content] of Object.entries(files)) {
        const parts = path.split("/");
        let node = tree;
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (i === parts.length - 1) {
            node[part] = { file: { contents: content } };
          } else {
            if (!node[part]) node[part] = { directory: {} };
            node = (node[part].directory ?? {}) as typeof tree;
          }
        }
      }
      await wc.mount(tree as Parameters<typeof wc.mount>[0]);
      setReady(true);
      onLine("WebContainer booted — npm commands run in-browser.", "info");
      return true;
    } catch (err) {
      onLine(
        err instanceof Error ? err.message : "WebContainer unavailable",
        "err",
      );
      setSupported(false);
      return false;
    } finally {
      bootingRef.current = false;
    }
  }, [supported, files, onLine]);

  const exec = useCallback(
    async (command: string): Promise<boolean> => {
      const wc = wcRef.current;
      if (!wc) return false;
      const parts = command.trim().match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);
      if (!parts?.length) return false;
      const unquote = (s: string) => s.replace(/^['"]|['"]$/g, "");
      const cmd = unquote(parts[0]);
      const args = parts.slice(1).map(unquote);
      try {
        const proc = await wc.spawn(cmd, args);
        proc.output.pipeTo(
          new WritableStream({
            write(chunk) {
              for (const line of String(chunk).split("\n").filter(Boolean)) {
                onLine(line, "out");
              }
            },
          }),
        );
        const code = await proc.exit;
        if (code !== 0) onLine(`[exit ${code}]`, "err");
        return true;
      } catch (err) {
        onLine(
          err instanceof Error ? err.message : "WebContainer exec failed",
          "err",
        );
        return false;
      }
    },
    [onLine],
  );

  useEffect(() => {
    if (projectId > 0 && supported && files && Object.keys(files).length > 0) {
      void boot();
    }
  }, [projectId, supported, files, boot]);

  useEffect(() => {
    return () => {
      wcRef.current?.teardown?.();
      wcRef.current = null;
    };
  }, [projectId]);

  return { ready, supported, boot, exec };
}

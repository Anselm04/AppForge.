import { useCallback, useEffect, useRef, useState } from "react";

type TerminalHandler = (text: string, kind: "out" | "err" | "info") => void;

type WebContainerModule = typeof import("@webcontainer/api");

function workspaceTree(files: Record<string, string>) {
  const tree: Record<
    string,
    { file?: { contents: string }; directory?: Record<string, unknown> }
  > = Object.create(null);
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split("/");
    if (
      path.includes("\\") ||
      parts.some(
        (p) =>
          !p ||
          p === "." ||
          p === ".." ||
          ["__proto__", "constructor", "prototype"].includes(p),
      )
    ) {
      throw new Error("Invalid workspace file path: " + path);
    }
    let node = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        node[part] = { file: { contents: content } };
      } else {
        if (!node[part]) node[part] = { directory: Object.create(null) };
        node = (node[part].directory ?? {}) as typeof tree;
      }
    }
  }
  return tree;
}

/** Browser WebContainer sandbox — layered above server micro-VM when supported. */
export function useWebContainerSandbox(
  projectId: number,
  files: Record<string, string> | undefined,
  onLine: TerminalHandler,
  onServerReady?: (url: string) => void,
) {
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const wcRef = useRef<Awaited<
    ReturnType<WebContainerModule["WebContainer"]["boot"]>
  > | null>(null);
  const bootingRef = useRef(false);
  const mountedFilesRef = useRef<Record<string, string> | undefined>();
  const generationRef = useRef(0);
  const onLineRef = useRef(onLine);
  const onServerReadyRef = useRef(onServerReady);
  onLineRef.current = onLine;
  onServerReadyRef.current = onServerReady;

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
    const generation = generationRef.current;
    try {
      const { WebContainer } = await import("@webcontainer/api");
      const wc = await WebContainer.boot();
      if (generation !== generationRef.current) {
        wc.teardown();
        return false;
      }
      wcRef.current = wc;
      wc.on("server-ready", (_port, url) => {
        try {
          const address = new URL(url);
          if (
            address.protocol !== "https:" ||
            address.username ||
            address.password
          ) {
            onLineRef.current("Invalid workspace preview URL", "err");
            return;
          }
        } catch {
          return;
        }
        onServerReadyRef.current?.(url);
        onLineRef.current("Workspace preview ready.", "info");
      });
      await wc.mount(workspaceTree(files) as Parameters<typeof wc.mount>[0]);
      mountedFilesRef.current = files;
      if (generation !== generationRef.current) return false;
      setReady(true);
      onLineRef.current(
        "WebContainer booted — npm commands run in-browser.",
        "info",
      );
      return true;
    } catch (err) {
      onLineRef.current(
        err instanceof Error ? err.message : "WebContainer unavailable",
        "err",
      );
      setSupported(false);
      return false;
    } finally {
      bootingRef.current = false;
    }
  }, [supported, files]);

  const exec = useCallback(async (command: string): Promise<boolean> => {
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
              onLineRef.current(line, "out");
            }
          },
        }),
      );
      const background =
        ["npm", "pnpm", "yarn"].includes(cmd) &&
        (args[0] === "run" ? args[1] : args[0]) &&
        ["dev", "start", "preview"].includes(
          args[0] === "run" ? args[1] : args[0],
        );
      if (background) {
        void proc.exit.then((code) => {
          onLineRef.current(
            `[server exited ${code}]`,
            code === 0 ? "info" : "err",
          );
        });
        return true;
      }
      const code = await proc.exit;
      if (code !== 0) onLineRef.current(`[exit ${code}]`, "err");
      return true;
    } catch (err) {
      onLineRef.current(
        err instanceof Error ? err.message : "WebContainer exec failed",
        "err",
      );
      return false;
    }
  }, []);

  useEffect(() => {
    if (projectId > 0 && supported && files && Object.keys(files).length > 0) {
      void boot();
    }
  }, [projectId, supported, files, boot]);

  useEffect(() => {
    const wc = wcRef.current;
    if (!ready || !wc || !files || mountedFilesRef.current === files) return;
    mountedFilesRef.current = files;
    void wc
      .mount(workspaceTree(files) as Parameters<typeof wc.mount>[0])
      .catch((error) => {
        onLineRef.current(
          error instanceof Error ? error.message : "Workspace sync failed",
          "err",
        );
      });
  }, [ready, files]);

  useEffect(() => {
    return () => {
      generationRef.current += 1;
      wcRef.current?.teardown?.();
      wcRef.current = null;
    };
  }, [projectId]);

  return { ready, supported, boot, exec };
}

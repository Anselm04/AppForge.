import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authHeaders } from "../lib/auth.js";
import { onPreviewUpdate } from "../lib/previewEvents.js";
import { trpc } from "../utils/trpc.js";
import { VisualProjectEditor } from "./VisualProjectEditor.js";

type Props = {
  projectId: number;
  deployUrl?: string | null;
  enabled?: boolean;
  browserPreviewUrl?: string | null;
};

export function BuildLivePreview({
  projectId,
  deployUrl,
  enabled = true,
  browserPreviewUrl,
}: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [hmrFlash, setHmrFlash] = useState(false);
  const [designMode, setDesignMode] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: devStatus } = useQuery({
    queryKey: ["sandbox", "devStatus", projectId],
    queryFn: () => trpc.sandbox.devStatus.query({ projectId }),
    enabled: enabled && projectId > 0 && !browserPreviewUrl,
    refetchInterval: 5000,
  });

  const useDevServer = !!devStatus?.running && !deployUrl && !browserPreviewUrl;

  const {
    data: previewAuthReady,
    error: previewAuthError,
    isLoading: previewAuthLoading,
  } = useQuery({
    queryKey: ["sandbox", "previewAuth", projectId],
    queryFn: async () => {
      const response = await fetch(`/api/preview-auth/${projectId}`, {
        method: "GET",
        credentials: "same-origin",
        headers: authHeaders(),
      });
      if (!response.ok) {
        throw new Error(`Preview authorization failed: ${response.status}`);
      }
      return true;
    },
    enabled: enabled && projectId > 0 && useDevServer,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (!enabled || projectId <= 0 || useDevServer) return;
    return onPreviewUpdate((detail) => {
      if (detail.projectId !== projectId) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setRefreshKey((key) => key + 1);
        setHmrFlash(true);
        setTimeout(() => setHmrFlash(false), 600);
      }, 400);
    });
  }, [projectId, enabled, useDevServer]);

  if (!enabled || projectId <= 0) {
    return (
      <div className="rounded-2xl border border-forge-border bg-forge-surface/70 p-5 text-sm text-forge-text-muted">
        Preview appears when the build has generated files.
      </div>
    );
  }

  if (useDevServer && previewAuthLoading) {
    return (
      <div className="rounded-2xl border border-forge-border bg-forge-surface/70 p-5 text-sm text-forge-text-muted">
        Preparing secure live preview…
      </div>
    );
  }

  if (useDevServer && previewAuthError) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5 text-sm text-red-600 dark:text-red-300">
        Live preview authorization failed. Refresh the page or sign in again.
      </div>
    );
  }

  const previewSrc = deployUrl
    ? deployUrl
    : browserPreviewUrl
      ? browserPreviewUrl
      : useDevServer && previewAuthReady
        ? `/sandbox-dev/${projectId}/`
        : `/apps/${projectId}?v=${refreshKey}`;

  const previewLabel = deployUrl
    ? "DEPLOYED PREVIEW"
    : browserPreviewUrl
      ? "LIVE PREVIEW"
      : useDevServer
        ? "LIVE DEV PREVIEW"
        : "VALIDATED PREVIEW";

  const previewDescription = deployUrl
    ? "Showing the deployed product."
    : browserPreviewUrl
      ? "Running from the active browser workspace."
      : useDevServer
        ? "Connected to the sandbox development server with live updates."
        : "Showing generated files and refreshing when validated edits arrive.";

  return (
    <div className="flex min-h-[420px] flex-col gap-3">
      <div className="flex flex-col gap-3 rounded-2xl border border-forge-border bg-forge-surface/90 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="forge-badge text-[10px]">{previewLabel}</span>
            {hmrFlash && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                <span className="animate-pulse">●</span> updated
              </span>
            )}
          </div>
          <p className="mt-2 text-xs leading-5 text-forge-text-muted">
            {previewDescription}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!deployUrl && !useDevServer && !browserPreviewUrl && (
            <button
              type="button"
              onClick={() => setDesignMode((value) => !value)}
              className="rounded-full border border-forge-border bg-forge-bg px-3 py-2 text-xs font-semibold text-forge-text-primary transition hover:border-forge-gold/60"
            >
              {designMode ? "Exit design" : "Design"}
            </button>
          )}
          {!useDevServer && (
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              aria-label="Refresh preview"
              className="rounded-full border border-forge-border bg-forge-bg px-3 py-2 text-xs font-semibold text-forge-text-primary transition hover:border-forge-gold/60"
            >
              Refresh
            </button>
          )}
          <a
            href={previewSrc}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open preview in a new tab"
            className="forge-gold-btn inline-flex min-h-9 items-center justify-center px-4 py-2 text-xs font-bold"
          >
            Open preview
          </a>
        </div>
      </div>

      <div className="min-h-[380px] flex-1 overflow-hidden rounded-2xl border border-forge-border bg-white shadow-(--forge-shadow-soft)">
        {designMode && !deployUrl && !useDevServer && !browserPreviewUrl ? (
          <VisualProjectEditor projectId={projectId} enabled={enabled} />
        ) : (
          <iframe
            key={previewSrc}
            src={previewSrc}
            title="App preview"
            referrerPolicy="no-referrer"
            className="h-full min-h-[380px] w-full bg-white"
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
          />
        )}
      </div>
    </div>
  );
}

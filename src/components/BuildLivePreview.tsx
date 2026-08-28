import { useEffect, useRef, useState } from "react";
import { authedUrl } from "../lib/auth.js";
import { onPreviewUpdate } from "../lib/previewEvents.js";

type Props = {
  projectId: number;
  deployUrl?: string | null;
  enabled?: boolean;
};

export function BuildLivePreview({
  projectId,
  deployUrl,
  enabled = true,
}: Props) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [hmrFlash, setHmrFlash] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled || projectId <= 0) return;
    return onPreviewUpdate((detail) => {
      if (detail.projectId !== projectId) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setRefreshKey((k) => k + 1);
        setHmrFlash(true);
        setTimeout(() => setHmrFlash(false), 600);
      }, 400);
    });
  }, [projectId, enabled]);

  if (!enabled || projectId <= 0) {
    return (
      <p className="text-slate-400 text-sm">
        Preview appears when the build has generated files.
      </p>
    );
  }

  const previewSrc =
    deployUrl || authedUrl(`/live/${projectId}?v=${refreshKey}`);

  return (
    <div className="flex flex-col gap-3 min-h-[420px]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-400">
          {deployUrl
            ? "Deployed preview"
            : "Instant preview — auto-refreshes when Monaco, chat, or sandbox edits files"}
          {hmrFlash && (
            <span className="ml-2 text-green-400 animate-pulse">● live</span>
          )}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg"
          >
            Refresh preview
          </button>
          <a
            href={previewSrc}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg"
          >
            Open in tab
          </a>
        </div>
      </div>
      <iframe
        key={previewSrc}
        src={previewSrc}
        title="App preview"
        className="flex-1 w-full min-h-[380px] rounded-lg border border-slate-700 bg-white"
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
      />
    </div>
  );
}

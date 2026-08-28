import { useState } from "react";
import { authedUrl } from "../lib/auth.js";

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

  if (!enabled || projectId <= 0) {
    return (
      <p className="text-slate-400 text-sm">
        Preview appears when the build has generated files.
      </p>
    );
  }

  const previewSrc =
    deployUrl || authedUrl(`/live/\${projectId}?v=\${refreshKey}`);

  return (
    <div className="flex flex-col gap-3 min-h-[420px]">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-slate-400">
          {deployUrl
            ? "Deployed preview"
            : "Live preview — rebuilds when you refresh after code changes"}
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

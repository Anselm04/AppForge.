type Props = {
  deployUrl?: string | null;
  deployGuide?: string[];
  techStack?: string | null;
};

export function DeployWizard({ deployUrl, deployGuide, techStack }: Props) {
  if (!deployUrl && (!deployGuide || deployGuide.length === 0)) return null;

  return (
    <div className="mt-4 bg-slate-800/80 border border-slate-600 rounded-lg p-4 text-slate-200">
      <h3 className="font-semibold text-lg mb-2">Deploy next steps</h3>
      {deployUrl && (
        <p className="text-sm mb-3">
          Live URL:{" "}
          <a
            href={deployUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 underline"
          >
            {deployUrl}
          </a>
        </p>
      )}
      {techStack && (
        <p className="text-xs text-slate-400 mb-3">Stack: {techStack}</p>
      )}
      <ol className="list-decimal list-inside space-y-2 text-sm text-slate-300">
        {(
          deployGuide ?? [
            "Set DATABASE_URL and API keys on your host.",
            "Run npm install && npm run build locally to verify.",
            "Configure auth callback URLs for Supabase/OAuth.",
            "Read REVIEW.md for AI-flagged issues.",
          ]
        ).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

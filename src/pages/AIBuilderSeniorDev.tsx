import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { CreditsPauseBanner } from "../components/CreditsPauseBanner.js";
import { useSeniorDev } from "../hooks/useSeniorDev.js";
import { SENIOR_DEV_CREDIT_COST } from "../lib/credits.js";

function PlanDisplay({
  plan,
  onApprove,
  onReject,
}: {
  plan: {
    approach: string;
    steps: Array<{
      step: number;
      title: string;
      files: string[];
      action: string;
      reason: string;
    }>;
    estimatedCredits: number;
  };
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg my-2">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        Implementation Plan
      </h3>
      <p className="text-sm text-gray-600 mb-4">{plan.approach}</p>
      <p className="text-sm text-gray-500 mb-4">
        Session cost: {SENIOR_DEV_CREDIT_COST} credits (reserved at start)
      </p>
      <div className="space-y-3">
        {plan.steps.map((s) => (
          <div key={s.step} className="p-3 bg-gray-50 rounded">
            <div className="font-medium text-gray-900">
              {s.step}. {s.title}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Action: <span className="font-medium">{s.action}</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              Files: {s.files.join(", ")}
            </div>
            <div className="text-sm text-gray-500 mt-1">{s.reason}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={onApprove}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Approve & Execute
        </button>
        <button
          onClick={onReject}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function SeniorDevPanel({ projectId }: { projectId: number }) {
  const {
    stage,
    plan,
    messages,
    result,
    error,
    isLoading,
    startTask,
    approvePlan,
    reset,
  } = useSeniorDev();
  const [request, setRequest] = useState("");
  const [mode, setMode] = useState<"collaborative" | "autonomous">(
    "collaborative",
  );
  const { data: tierStatus } = useQuery({
    queryKey: ["projects", "tierStatus"],
    queryFn: () => trpc.projects.tierStatus.query(),
  });
  const creditBalance = tierStatus?.credits ?? 0;
  const outOfCredits =
    tierStatus !== undefined && creditBalance < SENIOR_DEV_CREDIT_COST;

  const handleStart = async () => {
    if (!request.trim() || outOfCredits) return;
    await startTask(projectId, request.trim(), mode);
  };

  return (
    <div className="flex flex-col h-full p-4">
      <textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder="Example: Add a dark mode toggle with theme persistence."
        className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        rows={4}
        disabled={isLoading}
      />

      <div className="flex items-center gap-4 mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="mode"
            checked={mode === "collaborative"}
            onChange={() => setMode("collaborative")}
            disabled={isLoading}
          />
          Collaborative (plan + approval)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="mode"
            checked={mode === "autonomous"}
            onChange={() => setMode("autonomous")}
            disabled={isLoading}
          />
          Autonomous
        </label>
      </div>

      <button
        onClick={handleStart}
        disabled={isLoading || !request.trim() || outOfCredits}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-300 mb-4"
      >
        {outOfCredits
          ? "Paused — out of credits"
          : isLoading && stage === "planning"
            ? "Analysing..."
            : `Start (${SENIOR_DEV_CREDIT_COST} credits)`}
      </button>

      {(outOfCredits || (error && /credit/i.test(error))) && (
        <CreditsPauseBanner
          credits={creditBalance}
          cost={SENIOR_DEV_CREDIT_COST}
          action="use the Senior Dev Agent"
        />
      )}
      {error && !/credit/i.test(error) && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded mb-4">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className="p-3 bg-gray-50 rounded text-sm text-gray-800">
            <span className="font-medium text-blue-700">[{msg.stage}]</span>{" "}
            {msg.message}
          </div>
        ))}

        {plan && stage === "awaiting_approval" && (
          <PlanDisplay
            plan={plan}
            onApprove={() => approvePlan()}
            onReject={reset}
          />
        )}

        {result && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-lg font-semibold text-green-900 mb-2">
              Task Complete
            </h3>
            <pre className="text-sm text-green-800 whitespace-pre-wrap">
              {result.summary}
            </pre>
            <p className="text-sm text-green-700 mt-2">
              Files changed: {result.filesChanged.join(", ")}
            </p>
            <button
              onClick={reset}
              className="mt-3 px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded hover:bg-green-200"
            >
              Start New Task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

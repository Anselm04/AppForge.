import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChatInterface } from "../components/ChatInterface.js";
import { AppPreview } from "../components/AppPreview.js";
import { useAIBuilder } from "../hooks/useAIBuilder.js";
import { useSeniorDev } from "../hooks/useSeniorDev.js";
import { useQuery } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { CreditsPauseBanner } from "../components/CreditsPauseBanner.js";
import { BUILD_CREDIT_COST, SENIOR_DEV_CREDIT_COST } from "../lib/credits.js";

type BuilderMode = "build" | "improve";

function PlanDisplay({
  plan,
  onApprove,
  onReject,
}: {
  plan: { approach: string; steps: Array<{ step: number; title: string; files: string[]; action: string; reason: string }>; estimatedCredits: number };
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg my-2">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Implementation Plan</h3>
      <p className="text-sm text-gray-600 mb-4">{plan.approach}</p>
      <p className="text-sm text-gray-500 mb-4">Estimated credits: {plan.estimatedCredits}</p>
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

function SeniorDevPanel({ projectId }: { projectId: number }) {
  const { stage, plan, messages, result, error, isLoading, startTask, approvePlan, reset } =
    useSeniorDev();
  const [request, setRequest] = useState("");
  const [mode, setMode] = useState<"collaborative" | "autonomous">("collaborative");
  const { data: tierStatus } = useQuery({
    queryKey: ["projects", "tierStatus"],
    queryFn: () => trpc.projects.tierStatus.query(),
  });
  const creditBalance = tierStatus?.credits ?? 0;
  const outOfCredits = tierStatus !== undefined && creditBalance < SENIOR_DEV_CREDIT_COST;

  const handleStart = async () => {
    if (!request.trim() || outOfCredits) return;
    await startTask(projectId, request.trim(), mode);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-900">Senior Dev Agent</h2>
        <p className="text-sm text-gray-500 mt-1">
          Describe a feature, fix, or improvement. The agent will plan, execute, validate, and
          self-correct.
        </p>
      </div>

      <div className="p-4 space-y-4">
        <textarea
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder="Example: Add a dark mode toggle with theme persistence. Use the existing Tailwind setup."
          className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          disabled={isLoading}
        />

        <div className="flex items-center gap-4">
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
            Autonomous (execute immediately)
          </label>
        </div>

        <button
          onClick={handleStart}
          disabled={isLoading || !request.trim() || outOfCredits}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-300"
        >
          {outOfCredits ? "Paused — out of credits" : isLoading && stage === "planning" ? "Analysing..." : "Start Task"}
        </button>

        {(outOfCredits || (error && /credit/i.test(error))) && (
          <CreditsPauseBanner credits={creditBalance} cost={SENIOR_DEV_CREDIT_COST} action="use the Senior Dev Agent" />
        )}
        {error && !/credit/i.test(error) && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded">{error}</div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className="p-3 bg-gray-50 rounded text-sm text-gray-800">
            <span className="font-medium text-blue-700">[{msg.stage}]</span> {msg.message}
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
            <h3 className="text-lg font-semibold text-green-900 mb-2">Task Complete</h3>
            <pre className="text-sm text-green-800 whitespace-pre-wrap">{result.summary}</pre>
            <p className="text-sm text-green-700 mt-2">
              Files changed: {result.filesChanged.join(", ")}
            </p>
            <p className="text-sm text-green-700">Credits spent: {result.creditsSpent}</p>
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

export function AIBuilder() {
  const [searchParams] = useSearchParams();
  const { messages, isBuilding, appData, sendMessage, clearChat } = useAIBuilder();
  const { data: tierStatus } = useQuery({
    queryKey: ["projects", "tierStatus"],
    queryFn: () => trpc.projects.tierStatus.query(),
  });
  const creditBalance = tierStatus?.credits ?? 0;
  const outOfCredits = tierStatus !== undefined && creditBalance < BUILD_CREDIT_COST;
  const [showPreview, setShowPreview] = useState(false);
  const [mode, setMode] = useState<BuilderMode>(
    (searchParams.get("mode") as BuilderMode) ?? "build"
  );
  const [projectId, setProjectId] = useState<number>(
    parseInt(searchParams.get("projectId") ?? "1", 10)
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel */}
      <div className="w-1/2 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AppForge AI Builder</h1>
            <p className="text-sm text-gray-500 mt-1">Build new apps or improve existing ones</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("build")}
              className={`px-3 py-1 text-sm rounded ${
                mode === "build"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Build New
            </button>
            <button
              onClick={() => setMode("improve")}
              className={`px-3 py-1 text-sm rounded ${
                mode === "improve"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Improve
            </button>
          </div>
        </div>

        {outOfCredits && (
          <div className="p-4">
            <CreditsPauseBanner credits={creditBalance} cost={BUILD_CREDIT_COST} action="use the AI builder" />
          </div>
        )}
        {mode === "build" ? (
          <ChatInterface
            messages={messages}
            isBuilding={isBuilding || outOfCredits}
            onSendMessage={(content) => {
              if (outOfCredits) return;
              return sendMessage(content);
            }}
            onClear={clearChat}
          />
        ) : (
          <SeniorDevPanel projectId={projectId} />
        )}
      </div>

      {/* Right Panel */}
      <div className="w-1/2 bg-white">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">Live Preview</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              {showPreview ? "Hide Preview" : "Show Preview"}
            </button>
            {appData && (
              <button
                onClick={() => window.open(appData.previewUrl, "_blank")}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
              >
                Open Preview
              </button>
            )}
          </div>
        </div>

        {showPreview && appData ? (
          <AppPreview appData={appData} />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center">
              <div className="text-6xl mb-4">🎨</div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">Your app will appear here</h3>
              <p className="text-gray-500 max-w-md">
                {mode === "build"
                  ? "Describe your app idea and watch it come to life."
                  : "The Senior Dev Agent will show changes here once complete."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIBuilder;

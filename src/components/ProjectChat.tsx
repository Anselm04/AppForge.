import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";
import { useSeniorDev } from "../hooks/useSeniorDev.js";
import { SENIOR_DEV_CREDIT_COST } from "../lib/credits.js";

type Props = {
  projectId: number;
};

function SeniorDevStream({
  stage,
  plan,
  messages,
  result,
  error,
  isLoading,
  onApprove,
  onReset,
}: {
  stage: string;
  plan: {
    approach: string;
    steps: Array<{ step: number; title: string; files: string[] }>;
  } | null;
  messages: Array<{ stage: string; message: string }>;
  result: { summary: string; filesChanged: string[] } | null;
  error: string | null;
  isLoading: boolean;
  onApprove: () => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-4 border-t border-slate-700 pt-4 space-y-2">
      <p className="text-xs font-semibold text-purple-300 uppercase tracking-wide">
        Senior Dev stream
      </p>
      {error && (
        <p className="text-sm text-red-300 bg-red-900/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {messages.map((msg, i) => (
        <div
          key={i}
          className="text-xs bg-slate-900/60 rounded px-2 py-1.5 text-slate-300"
        >
          <span className="text-purple-400">[{msg.stage}]</span> {msg.message}
        </div>
      ))}
      {plan && stage === "awaiting_approval" && (
        <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 text-sm">
          <p className="text-slate-200 font-medium mb-2">{plan.approach}</p>
          <ul className="text-slate-400 text-xs space-y-1 mb-3">
            {plan.steps.map((s) => (
              <li key={s.step}>
                {s.step}. {s.title} ({s.files.join(", ")})
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-xs"
            >
              Approve & execute
            </button>
            <button
              type="button"
              onClick={onReset}
              className="bg-slate-600 hover:bg-slate-500 text-white px-3 py-1.5 rounded text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {result && (
        <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 text-sm text-green-200">
          <p className="font-medium">Changes applied</p>
          <p className="text-xs mt-1 whitespace-pre-wrap">{result.summary}</p>
          <p className="text-xs mt-2 opacity-80">
            Files: {result.filesChanged.join(", ")}
          </p>
          <button
            type="button"
            onClick={onReset}
            className="mt-2 text-xs bg-green-800 hover:bg-green-700 px-3 py-1 rounded"
          >
            Done
          </button>
        </div>
      )}
      {isLoading && !result && stage !== "awaiting_approval" && (
        <p className="text-xs text-slate-500 animate-pulse">
          Senior Dev is working…
        </p>
      )}
    </div>
  );
}

export function ProjectChat({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const {
    stage,
    plan,
    messages: devMessages,
    result,
    error: devError,
    isLoading: devLoading,
    connectToTask,
    approvePlan,
    reset: resetDev,
  } = useSeniorDev();

  const { data: messages } = useQuery({
    queryKey: ["projectChat", projectId],
    queryFn: () => trpc.projectChat.list.query({ projectId }),
    refetchInterval: 8000,
  });

  const send = useMutation({
    mutationFn: (payload: { content: string; triggerSeniorDev: boolean }) =>
      trpc.projectChat.send.mutate({ projectId, ...payload }),
    onSuccess: (data) => {
      setText("");
      void queryClient.invalidateQueries({
        queryKey: ["projectChat", projectId],
      });
      if (data.seniorDevTaskId) {
        connectToTask(data.seniorDevTaskId);
      }
    },
  });

  return (
    <div className="flex flex-col gap-3 min-h-[280px]">
      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-3 overflow-y-auto max-h-[320px] space-y-2">
        {(messages ?? []).map((m) => (
          <div
            key={m.id}
            className={`text-sm rounded-lg px-3 py-2 \${
              m.role === "user"
                ? "bg-blue-900/40 text-blue-100 ml-8"
                : "bg-slate-700 text-slate-200 mr-8"
            }`}
          >
            <p className="text-xs opacity-60 mb-1">{m.role}</p>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {(!messages || messages.length === 0) && (
          <p className="text-slate-500 text-sm">
            Ask for changes — e.g. &quot;Add dark mode toggle&quot; or &quot;Fix
            the login form validation.&quot;
          </p>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe what to change in this project…"
        className="w-full min-h-[80px] bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-slate-200"
      />
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled={!text.trim() || send.isPending}
          onClick={() =>
            send.mutate({ content: text.trim(), triggerSeniorDev: false })
          }
          className="bg-slate-600 hover:bg-slate-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
        >
          Save message
        </button>
        <button
          type="button"
          disabled={!text.trim() || send.isPending || devLoading}
          onClick={() =>
            send.mutate({ content: text.trim(), triggerSeniorDev: true })
          }
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
        >
          Improve with Senior Dev ({SENIOR_DEV_CREDIT_COST} credits)
        </button>
      </div>

      {(devLoading ||
        devMessages.length > 0 ||
        devError ||
        result ||
        stage === "awaiting_approval") && (
        <SeniorDevStream
          stage={stage}
          plan={plan}
          messages={devMessages}
          result={result}
          error={devError}
          isLoading={devLoading}
          onApprove={() => void approvePlan()}
          onReset={resetDev}
        />
      )}
    </div>
  );
}

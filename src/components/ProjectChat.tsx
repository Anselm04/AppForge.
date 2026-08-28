import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "../utils/trpc.js";

type Props = {
  projectId: number;
};

export function ProjectChat({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const { data: messages } = useQuery({
    queryKey: ["projectChat", projectId],
    queryFn: () => trpc.projectChat.list.query({ projectId }),
    refetchInterval: 8000,
  });

  const send = useMutation({
    mutationFn: (payload: { content: string; triggerSeniorDev: boolean }) =>
      trpc.projectChat.send.mutate({ projectId, ...payload }),
    onSuccess: () => {
      setText("");
      void queryClient.invalidateQueries({
        queryKey: ["projectChat", projectId],
      });
    },
  });

  return (
    <div className="flex flex-col gap-3 min-h-[280px]">
      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-3 overflow-y-auto max-h-[320px] space-y-2">
        {(messages ?? []).map((m) => (
          <div
            key={m.id}
            className={`text-sm rounded-lg px-3 py-2 ${
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
      <div className="flex gap-2">
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
          disabled={!text.trim() || send.isPending}
          onClick={() =>
            send.mutate({ content: text.trim(), triggerSeniorDev: true })
          }
          className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
        >
          Improve with Senior Dev
        </button>
      </div>
    </div>
  );
}

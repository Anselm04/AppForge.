import { useState, useCallback, useRef } from "react";
import { getAccessToken, authedUrl } from "../lib/auth.js";

export type DevMode = "collaborative" | "autonomous";

export type DevStage =
  | "idle"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "validating"
  | "fixing"
  | "completed"
  | "failed";

export type PlanStep = {
  step: number;
  title: string;
  files: string[];
  action: string;
  reason: string;
};

export type AgentPlan = {
  approach: string;
  steps: PlanStep[];
  estimatedCredits: number;
};

export type ProgressMessage = {
  stage: DevStage;
  message: string;
  detail?: Record<string, unknown>;
};

export type DevResult = {
  summary: string;
  filesChanged: string[];
  creditsSpent: number;
};

export function useSeniorDev() {
  const [stage, setStage] = useState<DevStage>("idle");
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [messages, setMessages] = useState<ProgressMessage[]>([]);
  const [result, setResult] = useState<DevResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const addMessage = useCallback((msg: ProgressMessage) => {
    setMessages((prev) => [...prev, msg]);
    setStage(msg.stage);
  }, []);

  const startTask = useCallback(
    async (projectId: number, request: string, mode: DevMode) => {
      disconnect();
      setMessages([]);
      setPlan(null);
      setResult(null);
      setError(null);
      setIsLoading(true);
      setStage("planning");

      try {
        const res = await fetch("/api/trpc/projects.seniorDev", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAccessToken() ?? ""}`,
          },
          body: JSON.stringify({
            json: { projectId, request, mode },
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err[0]?.error?.message ?? "Failed to create task");
        }

        const data = await res.json();
        const taskId = data[0]?.result?.data?.json?.taskId;
        if (!taskId) throw new Error("No task ID returned");

        const es = new EventSource(authedUrl(`/api/build/senior/${taskId}`));
        eventSourceRef.current = es;
        setActiveTaskId(taskId);

        es.addEventListener("progress", (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as ProgressMessage;
            addMessage(data);
            if ((data.detail?.steps as any)?.length) {
              setPlan(data.detail as unknown as AgentPlan);
            }
          } catch {
            addMessage({ stage: "executing", message: e.data });
          }
        });

        es.addEventListener("done", (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as DevResult;
            setResult(data);
          } catch {
            /* noop */
          }
          setIsLoading(false);
          disconnect();
        });

        es.addEventListener("error", (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data) as { message: string };
            setError(data.message ?? "Unknown error");
          } catch {
            setError("Stream error");
          }
          setIsLoading(false);
          disconnect();
        });

        return taskId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setIsLoading(false);
        throw err;
      }
    },
    [disconnect, addMessage],
  );

  const approvePlan = useCallback(async () => {
    const taskId = activeTaskId;
    if (!taskId) throw new Error("No active task to approve");
    try {
      const res = await fetch("/api/trpc/projects.seniorDevApprove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAccessToken() ?? ""}`,
        },
        body: JSON.stringify({ json: { taskId } }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err[0]?.error?.message ?? "Approval failed");
      }

      setStage("executing");
      addMessage({
        stage: "executing",
        message: "Plan approved. Executing changes...",
      });

      // Resume uses POST /resume — open a short-lived fetch stream via EventSource
      // after kicking resume (GET SSE on resume endpoint via query-token EventSource).
      const resumeRes = await fetch(
        authedUrl(`/api/build/senior/${taskId}/resume`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${getAccessToken() ?? ""}` },
        },
      );
      if (!resumeRes.ok || !resumeRes.body) {
        throw new Error("Failed to resume Senior Dev after approval");
      }

      // Parse SSE from fetch body (resume is POST, not EventSource-compatible)
      const reader = resumeRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const processChunk = async () => {
        let reading = true;
        while (reading) {
          const { done, value } = await reader.read();
          if (done) {
            reading = false;
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";
          for (const part of parts) {
            const lines = part.split("\n");
            let event = "message";
            let data = "";
            for (const line of lines) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              if (line.startsWith("data:")) data += line.slice(5).trim();
            }
            if (!data) continue;
            if (event === "progress") {
              try {
                addMessage(JSON.parse(data) as ProgressMessage);
              } catch {
                addMessage({ stage: "executing", message: data });
              }
            } else if (event === "done") {
              try {
                setResult(JSON.parse(data) as DevResult);
              } catch {
                /* noop */
              }
              setIsLoading(false);
            } else if (event === "error") {
              try {
                const err = JSON.parse(data) as { message?: string };
                addMessage({ stage: "failed", message: err.message ?? data });
              } catch {
                addMessage({ stage: "failed", message: data });
              }
              setIsLoading(false);
            }
          }
        }
      };
      await processChunk();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsLoading(false);
      throw err;
    }
  }, [activeTaskId, addMessage]);

  const reset = useCallback(() => {
    disconnect();
    setStage("idle");
    setPlan(null);
    setMessages([]);
    setResult(null);
    setError(null);
    setIsLoading(false);
  }, [disconnect]);

  return {
    stage,
    plan,
    messages,
    result,
    error,
    isLoading,
    startTask,
    approvePlan,
    reset,
  };
}

export default useSeniorDev;

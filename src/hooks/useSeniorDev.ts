import { useState, useCallback, useRef } from "react";
import { getAccessToken } from "../lib/auth.js";
import { consumeAuthedSse, readSseBody } from "../lib/authedSse.js";

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
  const streamControllerRef = useRef<AbortController | null>(null);

  const disconnect = useCallback(() => {
    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
  }, []);

  const addMessage = useCallback((msg: ProgressMessage) => {
    setMessages((prev) => [...prev, msg]);
    setStage(msg.stage);
  }, []);

  const handleStreamEvent = useCallback(
    (event: string, raw: string) => {
      if (event === "progress") {
        try {
          const data = JSON.parse(raw) as ProgressMessage;
          addMessage(data);
          if ((data.detail?.steps as unknown[])?.length) {
            setPlan(data.detail as unknown as AgentPlan);
          }
        } catch {
          addMessage({ stage: "executing", message: raw });
        }
        return;
      }

      if (event === "awaiting_approval") {
        try {
          const data = JSON.parse(raw) as { plan?: AgentPlan };
          if (data.plan) setPlan(data.plan);
        } catch {
          /* keep the state transition even if payload parsing fails */
        }
        setStage("awaiting_approval");
        addMessage({
          stage: "awaiting_approval",
          message: "Plan ready — review and approve to continue.",
        });
        setIsLoading(false);
        return;
      }

      if (event === "done") {
        try {
          setResult(JSON.parse(raw) as DevResult);
        } catch {
          /* noop */
        }
        setIsLoading(false);
        disconnect();
        return;
      }

      if (event === "error") {
        try {
          const data = JSON.parse(raw) as { message?: string };
          setError(data.message ?? "Unknown error");
          addMessage({ stage: "failed", message: data.message ?? raw });
        } catch {
          setError("Stream error");
          addMessage({ stage: "failed", message: raw });
        }
        setIsLoading(false);
        disconnect();
      }
    },
    [addMessage, disconnect],
  );

  const attachSeniorDevStream = useCallback(
    (taskId: number) => {
      disconnect();
      setMessages([]);
      setPlan(null);
      setResult(null);
      setError(null);
      setIsLoading(true);
      setStage("planning");
      setActiveTaskId(taskId);

      const controller = new AbortController();
      streamControllerRef.current = controller;

      void consumeAuthedSse(
        `/api/build/senior/${taskId}`,
        handleStreamEvent,
        controller.signal,
      ).catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setStage("failed");
        setIsLoading(false);
        if (streamControllerRef.current === controller) {
          streamControllerRef.current = null;
        }
      });
    },
    [disconnect, handleStreamEvent],
  );

  const startTask = useCallback(
    async (projectId: number, request: string, mode: DevMode) => {
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

        attachSeniorDevStream(taskId);
        return taskId;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setIsLoading(false);
        throw err;
      }
    },
    [attachSeniorDevStream],
  );

  const connectToTask = useCallback(
    (taskId: number) => {
      attachSeniorDevStream(taskId);
      return taskId;
    },
    [attachSeniorDevStream],
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
      setIsLoading(true);
      addMessage({
        stage: "executing",
        message: "Plan approved. Executing changes...",
      });

      const token = getAccessToken();
      if (!token) throw new Error("Not authenticated");

      const resumeRes = await fetch(`/api/build/senior/${taskId}/resume`, {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
          "X-No-Compression": "1",
          Authorization: `Bearer ${token}`,
        },
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!resumeRes.ok || !resumeRes.body) {
        throw new Error("Failed to resume Senior Dev after approval");
      }

      await readSseBody(resumeRes.body, handleStreamEvent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStage("failed");
      setIsLoading(false);
      throw err;
    }
  }, [activeTaskId, addMessage, handleStreamEvent]);

  const reset = useCallback(() => {
    disconnect();
    setStage("idle");
    setPlan(null);
    setMessages([]);
    setResult(null);
    setError(null);
    setIsLoading(false);
    setActiveTaskId(null);
  }, [disconnect]);

  return {
    stage,
    plan,
    messages,
    result,
    error,
    isLoading,
    startTask,
    connectToTask,
    approvePlan,
    reset,
  };
}

export default useSeniorDev;

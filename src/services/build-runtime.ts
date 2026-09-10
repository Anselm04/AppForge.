import { EventEmitter } from "events";
import { logger } from "../_core/logger.js";
import { getLatestTerminalBuildEvent } from "./build-event-store.js";

export type BuildEventPayload = { event: string; data: unknown };

const emitters = new Map<number, EventEmitter>();

function getEmitter(projectId: number): EventEmitter {
  let emitter = emitters.get(projectId);
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(50);
    emitters.set(projectId, emitter);
  }
  return emitter;
}

function isTerminalEvent(event: string): boolean {
  return event === "done" || event === "error";
}

export function publishRuntimeBuildEvent(
  projectId: number,
  event: string,
  data: unknown,
): void {
  getEmitter(projectId).emit("event", {
    event,
    data,
  } satisfies BuildEventPayload);
}

export function subscribeRuntimeBuildEvents(
  projectId: number,
  handler: (payload: BuildEventPayload) => void,
): () => void {
  const emitter = getEmitter(projectId);
  let active = true;
  let listener: (payload: BuildEventPayload) => void;

  const unsubscribe = () => {
    if (!active) return;
    active = false;
    emitter.off("event", listener);
  };

  listener = (payload: BuildEventPayload) => {
    if (!active) return;
    handler(payload);
    if (isTerminalEvent(payload.event)) unsubscribe();
  };
  emitter.on("event", listener);

  // Attach the listener first, then check persisted terminal state. Because the
  // worker persists before publishing, this covers an event that lands between
  // the route's historical replay and this subscription. Terminal delivery also
  // self-cleans the listener so route-level close timing cannot leak it.
  void getLatestTerminalBuildEvent(projectId)
    .then((terminal) => {
      if (!active || !terminal) return;
      handler({ event: terminal.event, data: terminal.payload });
      unsubscribe();
    })
    .catch((error: unknown) => {
      logger.error(
        { projectId, error },
        "runtime_build_terminal_catchup_failed",
      );
    });

  return unsubscribe;
}

export function clearRuntimeBuild(projectId: number): void {
  const emitter = emitters.get(projectId);
  if (emitter) {
    emitter.removeAllListeners();
    emitters.delete(projectId);
  }
}

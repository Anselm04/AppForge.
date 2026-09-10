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
  const listener = (payload: BuildEventPayload) => {
    if (active) handler(payload);
  };
  emitter.on("event", listener);

  // Attach the listener first, then check persisted terminal state. Because the
  // worker persists before publishing, this covers an event that lands between
  // the route's historical replay and this subscription. If the same terminal
  // event also arrives live, the route's closed guard makes the second signal a
  // no-op.
  void getLatestTerminalBuildEvent(projectId)
    .then((terminal) => {
      if (!active || !terminal) return;
      handler({ event: terminal.event, data: terminal.payload });
    })
    .catch((error: unknown) => {
      logger.error(
        { projectId, error },
        "runtime_build_terminal_catchup_failed",
      );
    });

  return () => {
    active = false;
    emitter.off("event", listener);
  };
}

export function clearRuntimeBuild(projectId: number): void {
  const emitter = emitters.get(projectId);
  if (emitter) {
    emitter.removeAllListeners();
    emitters.delete(projectId);
  }
}

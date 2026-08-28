import { EventEmitter } from "events";

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
  const listener = (payload: BuildEventPayload) => handler(payload);
  emitter.on("event", listener);
  return () => emitter.off("event", listener);
}

export function clearRuntimeBuild(projectId: number): void {
  const emitter = emitters.get(projectId);
  if (emitter) {
    emitter.removeAllListeners();
    emitters.delete(projectId);
  }
}

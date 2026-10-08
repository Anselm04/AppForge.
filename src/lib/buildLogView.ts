/** Keep streaming output readable without rendering a row for every token.
 * Full event history remains on the server; this is only the live display window.
 */
export interface BuildLogEntry {
  agent: string;
  type: string;
  payload?: {
    message?: string;
    type?: string;
    text?: string;
    spent?: number;
    creditsSpent?: number;
  };
}

const MAX_VISIBLE_LOGS = 200;
const MAX_STREAM_TEXT = 4096;

export function appendVisibleBuildLog(
  previous: BuildLogEntry[],
  incoming: BuildLogEntry,
): BuildLogEntry[] {
  if (incoming.type === "chunk") {
    const last = previous.at(-1);
    const coalesce = last?.type === "chunk" && last.agent === incoming.agent;
    const entry = {
      ...incoming,
      payload: {
        ...incoming.payload,
        message: "Streaming output…",
        text: `${coalesce ? (last.payload?.text ?? "") : ""}${incoming.payload?.text ?? ""}`.slice(
          -MAX_STREAM_TEXT,
        ),
      },
    };
    return [...(coalesce ? previous.slice(0, -1) : previous), entry].slice(
      -MAX_VISIBLE_LOGS,
    );
  }
  return [...previous, incoming].slice(-MAX_VISIBLE_LOGS);
}

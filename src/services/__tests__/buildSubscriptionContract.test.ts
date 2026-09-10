import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const queueSource = readFileSync(
  resolve(process.cwd(), "src/services/build-queue.ts"),
  "utf8",
);
const eventStoreSource = readFileSync(
  resolve(process.cwd(), "src/services/build-event-store.ts"),
  "utf8",
);

describe("build subscription hardening contract", () => {
  it("subscribes to Redis before checking persisted terminal state", () => {
    const subscribeIndex = queueSource.indexOf("await sub.subscribe(channel");
    const catchupIndex = queueSource.indexOf(
      "const terminal = await getLatestTerminalBuildEvent(projectId)",
    );

    expect(subscribeIndex).toBeGreaterThan(-1);
    expect(catchupIndex).toBeGreaterThan(subscribeIndex);
  });

  it("self-closes Redis subscriptions after terminal delivery", () => {
    expect(queueSource).toContain(
      "if (isTerminalEvent(parsed.event)) void closeSubscription()",
    );
    expect(queueSource).toContain("await closeSubscription()");
    expect(queueSource).toContain("await sub.unsubscribe(channel)");
    expect(queueSource).toContain("if (sub.isOpen) await sub.quit()");
  });

  it("queries only persisted terminal events for catch-up", () => {
    expect(eventStoreSource).toContain("getLatestTerminalBuildEvent");
    expect(eventStoreSource).toContain("AND event IN ('done', 'error')");
    expect(eventStoreSource).toContain("ORDER BY id DESC");
    expect(eventStoreSource).toContain("LIMIT 1");
  });
});

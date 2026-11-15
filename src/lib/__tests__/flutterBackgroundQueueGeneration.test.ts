import { describe, expect, it } from "vitest";
import { buildProductContract } from "../productContract.js";
import { applyFlutterNativeCapabilitySupport } from "../../services/flutterNativeCapabilitySupport.js";

describe("generated Flutter background queue Redis connection", () => {
  const productContract = {
    ...buildProductContract(
      "Build an iPhone and Android mobile app that runs durable background jobs and recurring scheduled monitoring.",
    ),
    selectedTechnologyStack: "flutter-node",
  } as const;

  it("emits BullMQ-compatible host, port, database and TLS connection options", () => {
    const files = applyFlutterNativeCapabilitySupport({}, productContract);
    const source = files["server/src/background/queue.ts"];
    expect(source).toContain("parsed = new URL(raw)");
    expect(source).toContain("host: parsed.hostname");
    expect(source).toContain("port,");
    expect(source).toContain("db,");
    expect(source).toContain("parsed.protocol === 'rediss:' ? { tls: {} }");
    expect(source).not.toContain("return { url };");
  });

  it("uses bounded producer retries and durable worker reconnection", () => {
    const source = applyFlutterNativeCapabilitySupport({}, productContract)[
      "server/src/background/queue.ts"
    ];
    expect(source).toContain("maxRetriesPerRequest: worker ? null : 1");
    expect(source).toContain("connection: redisConnection(),");
    expect(source).toContain("connection: redisConnection(true),");
    expect(source).toContain("REDIS_URL must use redis:// or rediss://");
  });

  it("preserves generated customer background worker source", () => {
    const original = "export const ownedWorker = true;";
    const files = applyFlutterNativeCapabilitySupport(
      { "server/src/background/queue.ts": original },
      productContract,
    );
    expect(files["server/src/background/queue.ts"]).toBe(original);
  });
});

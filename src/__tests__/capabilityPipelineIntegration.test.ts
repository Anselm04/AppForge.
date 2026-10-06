import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("capability broker build integration", () => {
  it("uses the broker from the real research stage without direct Composio SDK access", () => {
    const research = source("src/agents/researchAgent.ts");
    expect(research).toContain("discoverCapabilitiesForResearch");
    expect(research).not.toContain("@composio/core");
    expect(research).not.toContain("COMPOSIO_SEARCH_TOOLS");
  });

  it("keeps provider details behind the internal capability research helper", () => {
    const helper = source("src/agents/capabilityResearch.ts");
    expect(helper).toContain("CapabilityBroker");
    expect(helper).toContain("ComposioProvider");
    expect(helper).toContain("resolveProjectOwner");
    expect(helper).not.toContain("trpc");
  });
});

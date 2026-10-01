import { describe, expect, it } from "vitest";
import {
  manualDeployPreflight,
  productionPlanForStack,
  buildDeploymentDecision,
} from "../stackDeployment.js";
import { STACK_ADAPTERS } from "../stackAdapters.js";
import {
  filterDeployOptionsForStack,
  projectReadinessForApi,
  stackPresentation,
} from "../stackPresentation.js";
import { getStackMeta } from "../stackMetadata.js";
import { getStackScaffold } from "../../services/stackScaffolds.js";
import { deployProject } from "../../services/deployer.js";

const STRUCTURAL_STACKS = [
  "react-native-expo",
  "flutter-firebase",
  "electron-react",
  "tauri-rust",
  "python-service",
  "ai-agent-python",
  "chrome-extension",
];

describe("production launch limitations", () => {
  it("keeps structural adapters source-only and out of production certification/deployment", () => {
    for (const stackId of STRUCTURAL_STACKS) {
      const adapter = STACK_ADAPTERS.find((item) => item.id === stackId)!;
      const presentation = stackPresentation(stackId);

      expect(adapter.generationMode).toBe("structural");
      expect(getStackMeta(stackId)).toMatchObject({
        generationMode: "structural",
        sourceDeliverable: true,
        deploymentTargets: [],
      });
      const scaffold = getStackScaffold(stackId);
      expect(
        JSON.parse(scaffold["appforge.stack.json"]).sourceDeliverable,
      ).toBe(true);
      expect(JSON.parse(scaffold["appforge.deploy.json"]).targets).toEqual([]);
      expect(presentation?.structuralOnly).toBe(true);
      expect(presentation?.deployDestinations).toEqual([]);
      expect(buildDeploymentDecision(stackId, "production")).toEqual({
        action: "skip",
        deployment: "structural_source_only",
      });
      expect(manualDeployPreflight(stackId, "fly")).toMatchObject({
        ok: false,
        error: "structural_only_stack",
      });
      expect(() => productionPlanForStack(stackId, {})).toThrow(
        /Structural-only stack/,
      );
    }
  });

  it("refuses hosted previews for structural source deliverables", async () => {
    await expect(
      deployProject({
        destination: "preview",
        projectName: "Native source",
        projectId: 12,
        techStack: "react-native-expo",
        files: {},
      }),
    ).rejects.toThrow(/source deliverable.*cannot be previewed or deployed/);
  });

  it("removes GitHub Pages from all production destination metadata", () => {
    const staticStack = STACK_ADAPTERS.find(
      (adapter) => adapter.id === "static-html",
    )!;
    expect(staticStack.deploymentTargets).not.toContain("github-pages");
    expect(stackPresentation("static-html")?.deployDestinations).not.toContain(
      "github-pages",
    );
    expect(manualDeployPreflight("static-html", "github-pages")).toMatchObject({
      ok: false,
      error: "destination_unsupported",
    });
  });

  it("exposes only ZIP export as an option for structural adapters", () => {
    expect(
      filterDeployOptionsForStack("python-service", {
        vercel: { configured: true },
        netlify: { configured: true },
        fly: { configured: true },
        preview: { configured: true },
        zip: { configured: true },
      }),
    ).toEqual({ zip: { configured: true } });
  });

  it("never exposes stale production certification for structural projects", () => {
    expect(
      projectReadinessForApi({
        id: 42,
        techStack: "chrome-extension",
        status: "production-certified",
        outputMaturity: "certified",
      }),
    ).toMatchObject({
      status: "validated",
      outputMaturity: "structural",
      generationMode: "structural",
      sourceDeliverable: true,
    });
  });

  it("fails closed for unknown project stacks in readiness responses", () => {
    expect(
      projectReadinessForApi({
        id: 43,
        techStack: "unknown-stack",
        status: "production-certified",
        outputMaturity: "certified",
      }),
    ).toMatchObject({
      status: "validated",
      outputMaturity: "structural",
      generationMode: "unknown",
      sourceDeliverable: true,
    });
  });
});

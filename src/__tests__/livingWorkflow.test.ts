import { describe, expect, it } from "vitest";
import { projectWorkflow } from "../lib/livingWorkflow.js";

describe("Living Workflow Canvas projection", () => {
  it("never invents completed stages from a running project", () => {
    const nodes = projectWorkflow(
      { status: "running", buildStage: "generating" },
      [],
    );
    expect(nodes.find((node) => node.id === "generate")?.state).toBe("running");
    expect(nodes.find((node) => node.id === "plan")?.state).toBe("queued");
    expect(nodes.find((node) => node.id === "preview")?.state).toBe("queued");
  });
  it("reflects real agent completion and does not assume other tasks passed", () => {
    const nodes = projectWorkflow(
      { status: "running", buildStage: "validating" },
      [
        {
          agent: "Coder",
          type: "task_complete",
          payload: { message: "Saved generated files" },
        },
      ],
    );
    expect(nodes.find((node) => node.id === "generate")?.state).toBe(
      "completed",
    );
    expect(nodes.find((node) => node.id === "verify")?.state).toBe("running");
    expect(nodes.find((node) => node.id === "deliver")?.state).toBe("queued");
  });
  it("shows pauses and failures without displaying running animations", () => {
    const paused = projectWorkflow(
      {
        status: "paused",
        buildStage: "planning",
        pauseReason: "approval_required",
      },
      [],
    );
    expect(paused.find((node) => node.id === "plan")).toMatchObject({
      state: "paused",
      detail: "approval_required",
    });
    const failed = projectWorkflow(
      { status: "failed", buildStage: "validating" },
      [],
    );
    expect(failed.find((node) => node.id === "verify")?.state).toBe("failed");
  });
  it("never calls deployment complete for a merely validated build", () => {
    const nodes = projectWorkflow(
      { status: "validated", buildStage: "validating" },
      [],
    );
    expect(nodes.find((node) => node.id === "verify")?.state).toBe("completed");
    expect(nodes.find((node) => node.id === "deliver")?.state).toBe("queued");
  });
});

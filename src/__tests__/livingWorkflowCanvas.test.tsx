import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../components/LiveSpecialistFlow.js", () => ({
  LiveSpecialistFlow: () => (
    <div data-testid="specialist-graph">Real task graph</div>
  ),
}));
vi.mock("../components/BuildLivePreview.js", () => ({
  BuildLivePreview: ({
    projectId,
    enabled,
  }: {
    projectId: number;
    enabled: boolean;
  }) => (
    <div data-testid="existing-real-preview">
      {projectId}:{String(enabled)}
    </div>
  ),
}));
import { LivingWorkflowCanvas } from "../components/LivingWorkflowCanvas.js";

const props = {
  projectId: 123,
  logs: [],
  canUseWorkspace: true,
};

describe("real Live Build Observatory user interactions", () => {
  it("keeps real preview locked until artifact readiness is confirmed", () => {
    render(<LivingWorkflowCanvas {...props} project={{ status: "running" }} />);
    expect(
      screen.getByRole("button", { name: "Open live preview" }),
    ).toBeDisabled();
    expect(screen.queryByTestId("existing-real-preview")).toBeNull();
    expect(screen.getByTestId("specialist-graph")).toBeInTheDocument();
  });

  it("opens the existing authenticated preview for a validated product", () => {
    render(
      <LivingWorkflowCanvas {...props} project={{ status: "validated" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open live preview" }));
    expect(screen.getByTestId("existing-real-preview")).toHaveTextContent(
      "123:true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Hide preview" }));
    expect(screen.queryByTestId("existing-real-preview")).toBeNull();
  });

  it("never opens preview when the customer lacks workspace permission", () => {
    render(
      <LivingWorkflowCanvas
        {...props}
        canUseWorkspace={false}
        project={{ status: "validated" }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Open live preview" }),
    ).toBeDisabled();
  });

  it("lets customers inspect a real stage without changing the build", () => {
    render(
      <LivingWorkflowCanvas
        {...props}
        project={{ status: "running", buildStage: "planning" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Planning/ }));
    expect(screen.getByRole("button", { name: /Planning/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

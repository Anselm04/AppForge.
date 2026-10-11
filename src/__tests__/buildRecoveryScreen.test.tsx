import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  project: {
    status: "paused",
    pauseReason: "retry_after_error",
    planStatus: "approved",
    productPlan: {
      title: "Task tracker",
      overview: "Saved plan",
      architecture: { summary: "React and Node" },
      implementationSequence: [],
    },
    productContract: { monetizationRequirements: [], integrations: [] },
  },
  resume: vi.fn(),
}));
vi.mock("react-router-dom", () => ({ useParams: () => ({ projectId: "68" }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data:
      queryKey[0] === "projects" && queryKey[1] === "68"
        ? state.project
        : undefined,
    refetch: vi.fn(),
  }),
}));
vi.mock("../utils/trpc.js", () => ({
  trpc: { projects: { resumeApprovedBuild: { mutate: state.resume } } },
}));
vi.mock("../lib/authedSse.js", () => ({
  consumeAuthedSse: () => new Promise(() => {}),
}));
vi.mock("../components/ProjectCodeEditor.js", () => ({
  ProjectCodeEditor: () => null,
}));
vi.mock("../components/ProjectChat.js", () => ({ ProjectChat: () => null }));
vi.mock("../components/BuildLivePreview.js", () => ({
  BuildLivePreview: () => <div data-testid="runtime-preview" />,
}));
vi.mock("../components/DeployWizard.js", () => ({ DeployWizard: () => null }));
vi.mock("../components/RevenueReadinessPanel.js", () => ({
  RevenueReadinessPanel: () => null,
}));
vi.mock("../components/AgentTerminal.js", () => ({
  AgentTerminal: () => null,
}));
import { Build } from "../pages/Build.js";
afterEach(() => {
  vi.clearAllMocks();
  state.project.status = "paused";
  state.project.planStatus = "approved";
});
describe("saved build recovery screen", () => {
  it.each(["validated", "production-certified"])(
    "preserves the runtime preview for a %s artifact",
    (status) => {
      state.project.status = status;
      render(<Build />);
      fireEvent.click(screen.getByRole("button", { name: "preview" }));
      expect(screen.getByTestId("runtime-preview")).toBeInTheDocument();
    },
  );
  it("explains that saved working files need validation rather than loading a blocked iframe", () => {
    state.project.planStatus = "approved";
    render(<Build />);
    fireEvent.click(screen.getByRole("button", { name: "preview" }));
    expect(screen.queryByTestId("runtime-preview")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Full build validation is required before preview. Your working edits are saved; check Logs and Evidence for the blocked step.",
      ),
    ).toBeInTheDocument();
  });
  it("offers a single retry for an interrupted build whose decisions are already approved", async () => {
    state.project.planStatus = "approved";
    state.resume.mockRejectedValue(
      new Error("Secure build runtime unavailable"),
    );
    render(<Build />);
    expect(
      screen.queryByTestId("build-approval-panel"),
    ).not.toBeInTheDocument();
    const panel = screen.getByTestId("build-retry-panel");
    expect(panel).not.toHaveTextContent("Complete the approvals");
    fireEvent.click(
      within(panel).getByRole("button", { name: "Retry saved build" }),
    );
    expect(
      await screen.findByText("Secure build runtime unavailable"),
    ).toBeInTheDocument();
    expect(state.resume).toHaveBeenCalledExactlyOnceWith({ projectId: 68 });
  });
  it("keeps unapproved decisions blocking the interrupted build", () => {
    state.project.planStatus = "awaiting_approval";
    render(<Build />);
    expect(screen.getByTestId("build-approval-panel")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Retry saved build" }),
    ).toBeDisabled();
  });
});

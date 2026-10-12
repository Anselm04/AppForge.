import React, { useEffect } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const workspace = vi.hoisted(() => ({
  mounts: 0,
  exits: 0,
  exportCall: vi.fn(),
  project: {
    id: 68,
    status: "validated",
    title: "Workspace test",
    techStack: "react-node",
    generatedFiles: { "src/App.tsx": "export default () => null" },
    planStatus: "approved",
    productContract: null,
  },
  me: { id: 1, isOwner: true, email: "owner@example.test" },
  tier: { credits: 100, unlimited: true },
}));
vi.mock("react-router-dom", () => ({ useParams: () => ({ projectId: "68" }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data:
      queryKey[0] === "auth"
        ? workspace.me
        : queryKey[1] === "tierStatus"
          ? workspace.tier
          : queryKey[0] === "projects" && queryKey[1] === "68"
            ? workspace.project
            : undefined,
    refetch: vi.fn(),
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("../utils/trpc.js", () => ({
  trpc: {
    github: {
      connectionStatus: {
        query: vi.fn().mockResolvedValue({ connected: true }),
      },
      pushToRepo: { mutate: workspace.exportCall },
    },
  },
}));
vi.mock("../lib/authedSse.js", () => ({ consumeAuthedSse: async () => {} }));
vi.mock("../components/ProjectCodeEditor.js", () => ({
  ProjectCodeEditor: () => <div>Saved code editor</div>,
}));
vi.mock("../components/ProjectChat.js", () => ({ ProjectChat: () => null }));
vi.mock("../components/DeployWizard.js", () => ({ DeployWizard: () => null }));
vi.mock("../components/RevenueReadinessPanel.js", () => ({
  RevenueReadinessPanel: () => null,
}));
vi.mock("../components/AgentTerminal.js", () => ({
  AgentTerminal: ({
    onPreviewReady,
  }: {
    onPreviewReady: (url: string) => void;
  }) => {
    useEffect(() => {
      workspace.mounts++;
      onPreviewReady("https://workspace.webcontainer-api.io");
      return () => {
        workspace.exits++;
      };
    }, [onPreviewReady]);
    return <div>Running workspace terminal</div>;
  },
}));
vi.mock("../components/BuildLivePreview.js", () => ({
  BuildLivePreview: ({ browserPreviewUrl }: { browserPreviewUrl: string }) => (
    <div data-testid="workspace-preview">{browserPreviewUrl}</div>
  ),
}));
import { Build } from "../pages/Build.js";
describe("actual Build tab lifetime", () => {
  it("keeps the workspace mounted and carries its URL through Terminal, Preview and Code", async () => {
    workspace.mounts = 0;
    workspace.exits = 0;
    const page = render(<Build />);
    await waitFor(() => expect(workspace.mounts).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "terminal" }));
    expect(screen.getByText("Running workspace terminal")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "preview" }));
    expect(screen.getByTestId("workspace-preview")).toHaveTextContent(
      "https://workspace.webcontainer-api.io",
    );
    expect(workspace.exits).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "code" }));
    expect(screen.getByText("Saved code editor")).toBeVisible();
    expect(workspace.mounts).toBe(1);
    expect(workspace.exits).toBe(0);
    page.unmount();
    expect(workspace.exits).toBe(1);
  });
  it("offers private/public repository choices before any export, even after page reload", async () => {
    workspace.exportCall
      .mockReset()
      .mockResolvedValue({
        repoUrl: "https://github.com/owner/chosen-product",
      });
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<Build />);
    fireEvent.click(screen.getByRole("button", { name: "Export to GitHub" }));
    expect(workspace.exportCall).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Repository visibility")).toHaveValue(
      "private",
    );
    fireEvent.change(screen.getByLabelText("Repository name"), {
      target: { value: "chosen-product" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Export to my GitHub account" }),
    );
    await waitFor(() =>
      expect(workspace.exportCall).toHaveBeenCalledWith({
        projectId: 68,
        repoName: "chosen-product",
        visibility: "private",
      }),
    );
    expect(open).toHaveBeenCalledWith(
      "https://github.com/owner/chosen-product",
      "_blank",
    );
    open.mockRestore();
  });
});

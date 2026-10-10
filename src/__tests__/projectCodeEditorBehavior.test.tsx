import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const mocks = vi.hoisted(() => ({ save: vi.fn(), files: vi.fn() }));
vi.mock("../utils/trpc.js", () => ({
  trpc: {
    projects: {
      getFiles: { query: mocks.files },
      validateFile: { mutate: vi.fn() },
    },
    versionedWrites: { updateFile: { mutate: mocks.save } },
  },
}));
vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Editor content"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
import { ProjectCodeEditor } from "../components/ProjectCodeEditor.js";

function mount() {
  mocks.files.mockResolvedValue({ "README.md": "Original" });
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <ProjectCodeEditor projectId={68} />
    </QueryClientProvider>,
  );
}
describe("Code editor save feedback", () => {
  it("saves an intentionally empty file and reports a working revision", async () => {
    mocks.save.mockResolvedValue({ ok: true });
    mount();
    const editor = await screen.findByRole("textbox", {
      name: "Editor content",
    });
    await waitFor(() => expect(editor).toHaveValue("Original"));
    fireEvent.change(editor, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save file" }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith({
        projectId: 68,
        path: "README.md",
        content: "",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Full build validation is required before deployment",
    );
  });
  it("shows rejected saves instead of silently implying persistence", async () => {
    mocks.save.mockRejectedValue(new Error("Project file not found"));
    mount();
    await screen.findByRole("textbox", { name: "Editor content" });
    fireEvent.click(screen.getByRole("button", { name: "Save file" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "File could not be saved: Project file not found",
    );
    expect(screen.queryByRole("status")).toBeNull();
  });
});

import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const api = vi.hoisted(() => ({
  me: vi.fn(),
  projects: vi.fn(),
  health: vi.fn(),
}));
vi.mock("../lib/auth.js", () => ({ useSession: () => null }));
vi.mock("../utils/trpc.js", () => ({
  trpc: {
    auth: { me: { query: api.me } },
    projects: { list: { query: api.projects } },
    ecosystem: { integrations: { query: api.health } },
  },
}));
import { RequireAuth } from "../components/auth/RequireAuth.js";
import { PluginWorkspace } from "../pages/PluginWorkspace.js";

function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={["/tools"]}>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route path="/tools" element={<PluginWorkspace />} />
          </Route>
          <Route path="/login" element={<p>Sign in required</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Tools uses verified server authentication", () => {
  it("renders cookie-authenticated users even without a local bearer session", async () => {
    api.me.mockResolvedValue({ id: 7, email: "unit@example.com" });
    api.projects.mockResolvedValue([]);
    api.health.mockResolvedValue({
      connected: 1,
      total: 1,
      integrations: [
        {
          id: "example",
          name: "Verified service",
          job: "Testing",
          state: "connected",
          message: "Verified without mutation",
        },
      ],
    });
    mount();
    expect(
      await screen.findByRole("heading", { name: "Tools & Plugins" }),
    ).toBeVisible();
    expect(await screen.findByText("Verified service")).toBeVisible();
    expect(screen.queryByText("Sign in required")).toBeNull();
    await waitFor(() => expect(api.health).toHaveBeenCalled());
  });
  it("keeps rejected server sessions outside the workspace", async () => {
    api.me.mockRejectedValue(new Error("Session expired"));
    mount();
    expect(await screen.findByText("Sign in required")).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Tools & Plugins" }),
    ).toBeNull();
    expect(api.health).not.toHaveBeenCalled();
  });
});

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { RequireOwner } from "../RequireOwner.js";

const session = vi.hoisted(() => ({
  me: null as null | {
    id: string;
    email: string;
    name: string;
    isOwner: boolean;
  },
}));

vi.mock("../../../utils/trpc.js", () => ({
  trpc: {
    auth: {
      me: {
        query: vi.fn(async () => session.me),
      },
    },
  },
}));

function renderGuard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RequireOwner>
                <div>admin dashboard</div>
              </RequireOwner>
            }
          />
          <Route path="/login" element={<div>sign in screen</div>} />
          <Route path="/dashboard" element={<div>your dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("owner-only admin dashboard guard", () => {
  it("renders the dashboard for the verified owner account", async () => {
    session.me = {
      id: "owner-1",
      email: "anselm.perkins@gmail.com",
      name: "Owner",
      isOwner: true,
    };

    renderGuard();

    expect(await screen.findByText("admin dashboard")).toBeInTheDocument();
  });

  it("never mounts the dashboard for a non-owner account", async () => {
    session.me = {
      id: "customer-1",
      email: "customer@example.com",
      name: "Customer",
      isOwner: false,
    };

    renderGuard();

    expect(await screen.findByTestId("owner-guard-denied")).toBeInTheDocument();
    expect(screen.queryByText("admin dashboard")).toBeNull();
  });

  it("sends signed-out visitors to sign in and back to /admin", async () => {
    session.me = null;

    renderGuard();

    expect(await screen.findByText("sign in screen")).toBeInTheDocument();
    expect(screen.queryByText("admin dashboard")).toBeNull();
  });
});

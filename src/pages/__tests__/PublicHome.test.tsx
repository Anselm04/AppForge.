import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PublicHome } from "../PublicHome.js";

const state = vi.hoisted(() => ({ data: null as unknown, isPending: false }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => state }));
vi.mock("../../utils/trpc.js", () => ({
  trpc: { auth: { me: { query: vi.fn() } } },
}));
vi.mock("../Home.js", () => ({ Home: () => <div>Private builder</div> }));
vi.mock("../LandingPage.js", () => ({
  LandingPage: () => <div>Public landing</div>,
}));

describe("public home session boundary", () => {
  it("shows the public landing for signed-out visitors", () => {
    state.data = null;
    state.isPending = false;
    render(<PublicHome />);
    expect(screen.getByText("Public landing")).toBeInTheDocument();
    expect(screen.queryByText("Private builder")).not.toBeInTheDocument();
  });
  it("does not mount the builder while the session is being checked", () => {
    state.isPending = true;
    render(<PublicHome />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("Private builder")).not.toBeInTheDocument();
  });
  it("mounts the builder for a server-confirmed session", () => {
    state.isPending = false;
    state.data = { id: 1 };
    render(<PublicHome />);
    expect(screen.getByText("Private builder")).toBeInTheDocument();
  });
});

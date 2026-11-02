import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  request: vi.fn(),
  verify: vi.fn(),
  me: vi.fn(),
  privateQuery: vi.fn(),
}));
vi.mock("../../utils/trpc.js", () => ({
  trpc: {
    admin: {
      mfaStatus: { query: mocks.status },
      requestMfa: { mutate: mocks.request },
      verifyMfa: { mutate: mocks.verify },
      me: { query: mocks.me },
      analytics: { query: mocks.privateQuery },
      operations: { query: mocks.privateQuery },
      projectEvidence: { query: mocks.privateQuery },
      listCodes: { query: mocks.privateQuery },
      moderationQueue: { query: mocks.privateQuery },
    },
  },
}));
import { Admin } from "../Admin.js";
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/admin?next=%2Faccount"]}>
        <Routes>
          <Route path="/admin" element={<Admin />} />
          <Route path="/account" element={<p>Owner account unlocked</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("owner dashboard SMS gate", () => {
  beforeEach(() => {
    mocks.status.mockResolvedValue({ verified: false, phoneHint: "••••4567" });
  });
  it("does not load god codes or any private dashboard data before MFA", async () => {
    mount();
    await screen.findByText("Admin verification required");
    expect(mocks.me).not.toHaveBeenCalled();
    expect(mocks.privateQuery).not.toHaveBeenCalled();
    expect(screen.queryByText("Create god code")).toBeNull();
  });
  it("keeps the dashboard locked after an invalid SMS code", async () => {
    mocks.verify.mockRejectedValue(new Error("Invalid code"));
    mount();
    await screen.findByText("Admin verification required");
    fireEvent.change(screen.getByLabelText("Admin SMS code"), {
      target: { value: "123456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and enter admin" }),
    );
    await screen.findByText(
      "That code was not accepted. Admin access remains locked.",
    );
    expect(mocks.privateQuery).not.toHaveBeenCalled();
  });
  it("shows the development fallback and submits its six-digit code", async () => {
    mocks.request.mockResolvedValue({
      sent: true,
      fallback: true,
      testCode: "654321",
    });
    mocks.verify.mockResolvedValue({ verified: false });
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: "Send SMS code to ••••4567" }),
    );
    await screen.findByText("654321");
    expect(
      screen.getByText(
        /If you receive an AppForge admin code you did not request/,
      ),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Admin SMS code"), {
      target: { value: "654321" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and enter admin" }),
    );
    await waitFor(() =>
      expect(mocks.verify).toHaveBeenCalledWith({ code: "654321" }),
    );
  });
  it("returns to the owner account only after the server verifies SMS", async () => {
    mocks.verify.mockImplementation(async () => {
      mocks.status.mockResolvedValue({ verified: true });
      return { verified: true };
    });
    mocks.me.mockResolvedValue({
      email: "anselm.perkins@gmail.com",
      isOwner: true,
    });
    mocks.privateQuery.mockResolvedValue(null);
    mount();
    await screen.findByText("Admin verification required");
    fireEvent.change(screen.getByLabelText("Admin SMS code"), {
      target: { value: "123456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and enter admin" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Owner account unlocked")).toBeInTheDocument(),
    );
    expect(mocks.verify).toHaveBeenCalledWith({ code: "123456" });
  });
});

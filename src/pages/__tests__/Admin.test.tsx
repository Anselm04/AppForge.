import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  status: vi.fn(),
  enroll: vi.fn(),
  verify: vi.fn(),
  adopt: vi.fn(),
  me: vi.fn(),
  privateQuery: vi.fn(),
}));
vi.mock("../../lib/auth.js", () => ({
  adoptOwnerTotpSession: mocks.adopt,
  safeAuthDestination: (value: string | null) => value || "/",
}));
vi.mock("../../utils/trpc.js", () => ({
  trpc: {
    admin: {
      totpStatus: { query: mocks.status },
      totpEnroll: { mutate: mocks.enroll },
      totpVerify: { mutate: mocks.verify },
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

const factorId = "123e4567-e89b-42d3-a456-426614174001";

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

describe("owner dashboard authenticator gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.status.mockResolvedValue({
      verified: false,
      enrolled: true,
      factorId,
      factorCount: 1,
    });
  });

  it("never loads private dashboard data before owner TOTP succeeds", async () => {
    mount();
    await screen.findByText("Owner authenticator required");
    expect(mocks.me).not.toHaveBeenCalled();
    expect(mocks.privateQuery).not.toHaveBeenCalled();
    expect(screen.queryByText("Create god code")).toBeNull();
  });

  it("keeps the dashboard locked after an invalid authenticator code", async () => {
    mocks.verify.mockRejectedValue(new Error("Invalid code"));
    mount();
    await screen.findByText("Owner authenticator required");
    fireEvent.change(screen.getByLabelText("Owner authenticator code"), {
      target: { value: "123456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and enter admin" }),
    );
    await screen.findByText(
      "Authenticator verification failed. Admin remains locked.",
    );
    expect(mocks.adopt).not.toHaveBeenCalled();
    expect(mocks.privateQuery).not.toHaveBeenCalled();
  });

  it("enrolls an authenticator without sending SMS and verifies its factor", async () => {
    mocks.status.mockResolvedValue({
      verified: false,
      enrolled: false,
      factorId: null,
      factorCount: 0,
    });
    mocks.enroll.mockResolvedValue({
      factorId,
      secret: "EXAMPLESECRET",
      uri: "otpauth://totp/AppForge:Owner?secret=EXAMPLESECRET",
    });
    mocks.verify.mockResolvedValue({
      verified: true,
      accessToken: "verified-session",
    });
    mount();
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Set up owner authenticator",
      }),
    );
    await screen.findByText("EXAMPLESECRET");
    fireEvent.change(screen.getByLabelText("Owner authenticator code"), {
      target: { value: "654321" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and enter admin" }),
    );
    await waitFor(() =>
      expect(mocks.verify).toHaveBeenCalledWith({
        factorId,
        code: "654321",
      }),
    );
    expect(mocks.enroll).toHaveBeenCalledTimes(1);
  });

  it("returns to the owner account only after verified TOTP updates the session", async () => {
    mocks.verify.mockImplementation(async () => {
      mocks.status.mockResolvedValue({
        verified: true,
        enrolled: true,
        factorId,
        factorCount: 1,
      });
      return { verified: true, accessToken: "verified-session" };
    });
    mocks.me.mockResolvedValue({ email: "owner@example.test", isOwner: true });
    mocks.privateQuery.mockResolvedValue(null);
    mount();
    await screen.findByText("Owner authenticator required");
    fireEvent.change(screen.getByLabelText("Owner authenticator code"), {
      target: { value: "123456" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Verify and enter admin" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Owner account unlocked")).toBeInTheDocument(),
    );
    expect(mocks.adopt).toHaveBeenCalledWith("verified-session");
    expect(mocks.verify).toHaveBeenCalledWith({
      factorId,
      code: "123456",
    });
  });
});

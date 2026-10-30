import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  password: vi.fn(),
  email: vi.fn(),
  remove: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  verification: vi.fn(),
}));
vi.mock("../../lib/auth.js", () => ({
  ensureFreshSession: mocks.refresh,
  logout: mocks.logout,
  signOutAllDevices: vi.fn(),
  signOutOtherDevices: vi.fn(),
}));
vi.mock("../../utils/trpc.js", () => ({
  trpc: {
    auth: { me: { query: async () => ({ email: "customer@example.com" }) } },
    account: {
      profile: {
        query: async () => ({
          name: "Customer",
          preferences: {
            language: "en",
            communications: { product: true, billing: true, marketing: false },
            accessibility: { reducedMotion: false, highContrast: false },
          },
        }),
      },
      changePassword: { mutate: mocks.password },
      changeEmail: { mutate: mocks.email },
      deleteAccount: { mutate: mocks.remove },
      requestPasswordVerification: { mutate: mocks.verification },
    },
    system: { diagnostics: { query: async () => null } },
  },
}));
import { Account } from "../Account.js";

function renderAccount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Account />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

describe("account management after cookie-backed refresh", () => {
  it("updates a password without needing a browser-held access token", async () => {
    mocks.refresh.mockResolvedValue({ user: { id: "identity-1" } });
    mocks.password.mockResolvedValue({ updated: true });
    renderAccount();
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await screen.findByText("Password changed successfully.");
    expect(mocks.password).toHaveBeenCalledWith({
      password: "NewPassword123!",
    });
  });

  it("requests a verified email change using the server session", async () => {
    mocks.email.mockResolvedValue({ confirmationRequired: true });
    renderAccount();
    fireEvent.change(screen.getByLabelText("New email"), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Request verified email change" }),
    );
    await waitFor(() =>
      expect(mocks.email).toHaveBeenCalledWith({ email: "new@example.com" }),
    );
  });

  it("clears browser authentication and cached private data after deletion", async () => {
    mocks.remove.mockResolvedValue({ deleted: true });
    mocks.logout.mockResolvedValue(undefined);
    const client = renderAccount();
    const clear = vi.spyOn(client, "clear");
    fireEvent.change(screen.getByLabelText("Type DELETE MY APPFORGE ACCOUNT"), {
      target: { value: "DELETE MY APPFORGE ACCOUNT" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Permanently delete my account" }),
    );
    await waitFor(() => expect(clear).toHaveBeenCalled());
    expect(mocks.remove).toHaveBeenCalledWith({
      confirmation: "DELETE MY APPFORGE ACCOUNT",
    });
    expect(mocks.logout).toHaveBeenCalledOnce();
  });

  it("lets the customer request and submit a password verification code", async () => {
    mocks.verification.mockResolvedValue({ sent: true });
    renderAccount();
    fireEvent.click(
      screen.getByRole("button", { name: "Send password verification code" }),
    );
    const code = await screen.findByLabelText("Password verification code");
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "NewPassword123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() =>
      expect(mocks.password).toHaveBeenCalledWith({
        password: "NewPassword123!",
        nonce: "123456",
      }),
    );
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../i18n/LocaleContext.js";
import { SocialAuthButtons } from "../SocialAuthButtons.js";

const { listProviders, startSignIn } = vi.hoisted(() => ({
  listProviders: vi.fn(),
  startSignIn: vi.fn(),
}));

vi.mock("../../../lib/auth.js", () => ({
  listSocialSignInProviders: listProviders,
  startSocialSignIn: startSignIn,
}));

function renderButtons() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <SocialAuthButtons next="/account" />
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

describe("social sign-in buttons", () => {
  it("renders only the providers the auth project has enabled", async () => {
    listProviders.mockResolvedValue(["google"]);

    renderButtons();

    expect(
      await screen.findByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue with GitHub" }),
    ).toBeNull();
  });

  it("starts the provider flow and preserves the return destination", async () => {
    listProviders.mockResolvedValue(["google", "github"]);

    renderButtons();

    fireEvent.click(
      await screen.findByRole("button", { name: "Continue with GitHub" }),
    );

    await waitFor(() =>
      expect(startSignIn).toHaveBeenCalledWith("github", "/account"),
    );
  });

  it("renders nothing when no external provider is configured", async () => {
    listProviders.mockResolvedValue([]);

    renderButtons();

    await waitFor(() => expect(listProviders).toHaveBeenCalled());
    expect(screen.queryByTestId("social-auth-buttons")).toBeNull();
    expect(screen.queryByText(/continue with email/i)).toBeNull();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../i18n/LocaleContext.js";
import { ThemeProvider } from "../../lib/theme";
import { TopNav } from "../TopNav.js";

const { mockNavigate, logoutMutate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  logoutMutate: vi.fn(async () => ({ success: true })),
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("../../utils/trpc.js", () => ({
  trpc: {
    auth: {
      me: {
        query: vi.fn(async () => ({
          id: "owner-1",
          email: "anselm.perkins@gmail.com",
          name: "Owner",
          isOwner: true,
        })),
      },
      logout: { mutate: logoutMutate },
    },
    subscriptions: {
      status: { query: vi.fn(async () => null) },
    },
  },
}));

beforeEach(() => {
  // Render the desktop navigation so the sign-out control is reachable
  // without opening the compact drawer.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe("signing out from the top navigation", () => {
  it("clears cached identity and returns the visitor to the public site", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(["auth", "me"], {
      id: "owner-1",
      email: "anselm.perkins@gmail.com",
      name: "Owner",
      isOwner: true,
    });
    const clearSpy = vi.spyOn(queryClient, "clear");

    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LocaleProvider>
            <BrowserRouter>
              <TopNav />
            </BrowserRouter>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Logout" }));

    await waitFor(() => expect(logoutMutate).toHaveBeenCalled());
    await waitFor(() => expect(clearSpy).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"));
  });
});

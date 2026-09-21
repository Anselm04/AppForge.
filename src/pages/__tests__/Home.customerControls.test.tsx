import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TopNav } from "../../components/TopNav";
import { LocaleProvider } from "../../i18n/LocaleContext";
import { signOut } from "../../lib/auth";
import { ThemeProvider } from "../../lib/theme";
import { Home } from "../Home";

vi.mock("../../utils/trpc.js", () => ({
  trpc: {
    auth: {
      me: { query: vi.fn(async () => null) },
      logout: { mutate: vi.fn(async () => ({ success: true })) },
    },
    subscriptions: {
      status: { query: vi.fn(async () => null) },
    },
    projects: {
      tierStatus: { query: vi.fn(async () => undefined) },
      create: { mutate: vi.fn() },
    },
  },
}));

function renderCustomerShell() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, throwOnError: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LocaleProvider>
          <BrowserRouter>
            <TopNav />
            <Home />
          </BrowserRouter>
        </LocaleProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("tester-facing customer shell interactions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    signOut();
    document.documentElement.lang = "";
    document.documentElement.dir = "";
  });

  it("accepts real prompt input instead of only rendering a textarea shell", () => {
    renderCustomerShell();

    const prompt = screen.getByTestId(
      "hero-app-idea-textarea",
    ) as HTMLTextAreaElement;
    fireEvent.change(prompt, {
      target: {
        value:
          "Build a production-ready booking app with authentication and payments",
      },
    });

    expect(prompt.value).toBe(
      "Build a production-ready booking app with authentication and payments",
    );
    expect(screen.getByTestId("home-generate-button")).toBeEnabled();
  });

  it("opens compact navigation, exposes 100+ languages, and applies a real translated locale", () => {
    window.localStorage.setItem("appforge.layout", "phone");
    renderCustomerShell();

    const menuButton = document.querySelector<HTMLButtonElement>(
      'button[aria-controls="mobile-nav-drawer"]',
    );
    expect(menuButton).not.toBeNull();

    fireEvent.click(menuButton!);

    const controls = screen.getByTestId("mobile-nav-controls");
    expect(controls).toBeVisible();

    const languageButton = within(controls).getByRole("button", {
      name: /language/i,
    });
    fireEvent.click(languageButton);

    const listbox = within(controls).getByRole("listbox");
    expect(listbox).toBeVisible();
    expect(within(listbox).getAllByRole("option").length).toBeGreaterThan(100);

    const french = within(listbox).getByRole("option", { name: "Français" });
    fireEvent.mouseDown(french);

    expect(document.documentElement.lang).toBe("fr");
    expect(document.documentElement.dir).toBe("ltr");
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "appforge.locale",
      "fr",
    );
    expect(
      within(controls).getByRole("button", { name: /langue/i }),
    ).toBeVisible();

    expect(
      within(controls).getByRole("button", { name: /sombre|dark/i }),
    ).toBeVisible();
    expect(
      within(controls).getByRole("button", { name: /clair|light/i }),
    ).toBeVisible();
  });
});

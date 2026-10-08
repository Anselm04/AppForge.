import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../i18n/LocaleContext.js";
import { Discover } from "../Discover.js";
import { FeatureDetail } from "../FeatureDetail.js";
import { HelpCenter } from "../HelpCenter.js";
import { NotFound } from "../NotFound.js";
import { Settings } from "../Settings.js";

vi.mock("../../utils/trpc.js", () => ({
  trpc: {
    auth: {
      me: {
        query: vi.fn(async () => ({
          id: "u1",
          email: "owner@appforge.dev",
          name: "Owner",
          isOwner: true,
        })),
      },
    },
  },
}));

function renderAt(route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/discover" element={<Discover />} />
            <Route path="/features/:id" element={<FeatureDetail />} />
            <Route path="/help" element={<HelpCenter />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MemoryRouter>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

describe("discovery surfaces", () => {
  it("renders every platform feature on the discover page", () => {
    renderAt("/discover");

    // The "Discover" sidebar label is also a category heading, so target the page h1.
    expect(
      screen.getByRole("heading", { level: 1, name: "Discover" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Multi-Agent Orchestrator/ }),
    ).toHaveAttribute("href", "/features/orchestrator");
  });

  it("renders a feature detail page with working call to action", () => {
    renderAt("/features/orchestrator");

    expect(
      screen.getByRole("heading", { name: "Multi-Agent Orchestrator" }),
    ).toBeInTheDocument();
    expect(screen.getByText("How it works")).toBeInTheDocument();
    const [primaryCta] = screen.getAllByRole("link", { name: "Try it now" });
    expect(primaryCta).toHaveAttribute("href", "/app/new");
  });

  it("falls back to a real destination when a feature's app route is unbuilt", () => {
    renderAt("/features/onboarding-assistant");

    expect(
      screen.getByRole("heading", { name: "AI Onboarding Assistant" }),
    ).toBeInTheDocument();
    // The feature declares /onboarding, which is not a shipped route yet.
    const [primaryCta] = screen.getAllByRole("link", { name: "Try it now" });
    expect(primaryCta).toHaveAttribute("href", "/app/new");
  });

  it("sends an unknown feature id back to discover", () => {
    renderAt("/features/not-a-real-feature");

    expect(
      screen.getByRole("heading", { level: 1, name: "Discover" }),
    ).toBeInTheDocument();
  });
});

describe("help centre", () => {
  it("lists topics and filters them by search", () => {
    renderAt("/help");

    expect(
      screen.getByRole("heading", { name: "Getting started" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Billing & credits" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "billing" },
    });

    expect(
      screen.getByRole("heading", { name: "Billing & credits" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Getting started" }),
    ).toBeNull();
  });
});

describe("settings hub", () => {
  it("shows the signed-in identity and links to real settings surfaces", async () => {
    renderAt("/settings");

    expect(await screen.findByText("owner@appforge.dev")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Account/ })).toHaveAttribute(
      "href",
      "/account",
    );
    expect(screen.getByRole("link", { name: /Billing/ })).toHaveAttribute(
      "href",
      "/pricing",
    );
  });
});

describe("not found page", () => {
  it("renders a real 404 for an unknown path", () => {
    renderAt("/this-route-does-not-exist");

    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to home/ })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

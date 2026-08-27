import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { LocaleProvider } from "../../i18n/LocaleContext";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { TopNav } from "../../components/TopNav";
import { Home } from "../Home";
import { getAccessToken, getSession, authedUrl } from "../../lib/auth";

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

function memoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem: (key: string) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

function installStorage(storage: ReturnType<typeof memoryStorage> | { getItem: () => never; setItem: () => never; removeItem: () => never; clear: () => void; key: () => null; length: number }) {
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
}

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, throwOnError: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <TopNav />
            <Home />
          </BrowserRouter>
        </ErrorBoundary>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

describe("Home first paint", () => {
  beforeEach(() => {
    installStorage(memoryStorage());
  });

  it("renders Home chrome instead of ErrorBoundary when logged out", () => {
    renderHome();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(screen.getAllByText("AppForge").length).toBeGreaterThan(0);
    expect(screen.getByText(/Build full-stack web apps/i)).toBeInTheDocument();
  });

  it("does not ErrorBoundary when a dummy appforge.session exists (React #185)", () => {
    const dummy = {
      accessToken: "dummy-token",
      refreshToken: "dummy-refresh",
      user: { id: "user-1", email: "dummy@example.com" },
    };
    installStorage(memoryStorage({ "appforge.session": JSON.stringify(dummy) }));
    const a = getSession();
    const b = getSession();
    expect(a).toBe(b);
    expect(a?.accessToken).toBe("dummy-token");
    renderHome();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(screen.getAllByText("AppForge").length).toBeGreaterThan(0);
  });

  it("does not crash when localStorage getItem throws (iOS Safari / ITP)", () => {
    const throwing = {
      getItem: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
      removeItem: () => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
      clear: () => {},
      key: () => null,
      length: 0,
    };
    installStorage(throwing);
    expect(getSession()).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(authedUrl("/api/build/1")).toBe("/api/build/1");
    renderHome();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    expect(screen.getAllByText("AppForge").length).toBeGreaterThan(0);
  });

  it("getSnapshot is stable for a valid session (authedUrl still appends token)", () => {
    const session = { accessToken: "tok", user: { id: "u1", email: "a@b.c" } };
    installStorage(memoryStorage({ "appforge.session": JSON.stringify(session) }));
    const a = getSession();
    const b = getSession();
    expect(a).toBe(b);
    expect(authedUrl("/api/build/9")).toBe("/api/build/9?token=tok");
  });
});

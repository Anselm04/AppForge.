import { StrictMode } from "react";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  me: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("../lib/auth.js", () => ({
  completeAuthRedirect: mocks.complete,
  safeAuthDestination: (path: string | null) => path || "/",
  signIn: vi.fn(),
}));
vi.mock("../utils/trpc.js", () => ({
  trpc: {
    auth: { me: { query: mocks.me } },
    sso: { discover: { query: vi.fn() } },
  },
}));
vi.mock("../i18n/LocaleContext.js", () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));
vi.mock("../components/auth/SocialAuthButtons.js", () => ({
  SocialAuthButtons: () => null,
}));
vi.mock("../components/auth/AuthShell.js", () => ({
  AuthShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("react-router-dom", async (original) => ({
  ...(await original<typeof import("react-router-dom")>()),
  useNavigate: () => mocks.navigate,
}));
import { Login } from "../pages/Login.js";

beforeEach(() => {
  mocks.complete.mockReset();
  mocks.me.mockReset();
  mocks.navigate.mockReset();
  window.history.replaceState(
    {},
    "",
    "/login#access_token=unit-callback-token",
  );
});

describe("social callback completion survives effect cleanup", () => {
  it("finishes the same callback once after the URL has been scrubbed", async () => {
    let resolve!: (value: unknown) => void;
    const completion = new Promise((resolvePromise) => {
      resolve = resolvePromise;
    });
    mocks.complete.mockImplementation(() => {
      window.history.replaceState({}, "", "/login");
      return completion;
    });
    mocks.me.mockResolvedValueOnce(null).mockResolvedValue({ id: 7 });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/login?next=/account"]}>
            <Login />
          </MemoryRouter>
        </QueryClientProvider>
      </StrictMode>,
    );
    resolve({ accessToken: "unit-memory-token", user: { id: 7 } });
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith("/account", {
        replace: true,
      }),
    );
    expect(mocks.complete).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(["auth", "me"])).toEqual({ id: 7 });
  });
});

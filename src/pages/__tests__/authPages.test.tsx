import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../i18n/LocaleContext.js";
import { Login } from "../Login.js";
import { Signup } from "../Signup.js";

vi.mock("../../utils/trpc.js", () => ({
  trpc: {
    auth: {
      me: { query: vi.fn(async () => null) },
      logout: { mutate: vi.fn() },
    },
    sso: { discover: { query: vi.fn(async () => ({ ssoAvailable: false })) } },
  },
}));

vi.mock("../../lib/auth.js", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/auth.js")>(
      "../../lib/auth.js",
    );
  return {
    ...actual,
    signIn: vi.fn(),
    signUp: vi.fn(),
    getSession: vi.fn(() => null),
    completeAuthRedirect: vi.fn(async () => null),
    listSocialSignInProviders: vi.fn(async () => []),
    startSocialSignIn: vi.fn(),
  };
});

function renderPage(ui: React.ReactElement, route: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </LocaleProvider>
    </QueryClientProvider>,
  );
}

describe("modern sign-in page", () => {
  it("offers email sign-in with a reveal control and inline email validation", () => {
    renderPage(<Login />, "/login");

    const email = screen.getByLabelText("Email");
    fireEvent.change(email, { target: { value: "not-an-email" } });
    fireEvent.blur(email);

    expect(
      screen.getByText("Enter a valid email address."),
    ).toBeInTheDocument();

    const password = screen.getByLabelText("Password") as HTMLInputElement;
    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("links to password recovery and account creation", () => {
    renderPage(<Login />, "/login");

    expect(
      screen.getByRole("link", { name: "Forgot password?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toBeInTheDocument();
  });
});

describe("modern create-account page", () => {
  it("shows a live password strength meter and mismatch feedback", () => {
    renderPage(<Signup />, "/signup");

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "ForgeBuilder1!" },
    });

    expect(screen.getByTestId("password-strength")).toBeInTheDocument();
    expect(screen.getByTestId("password-strength-level")).toHaveTextContent(
      "Strong",
    );

    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Different1!" },
    });
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
  });
});

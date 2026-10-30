import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  me: vi.fn(),
  request: vi.fn(),
  verify: vi.fn(),
}));
vi.mock("../../utils/trpc.js", () => ({
  trpc: {
    auth: {
      me: { query: mocks.me },
      requestPhoneVerification: { mutate: mocks.request },
      verifyPhone: { mutate: mocks.verify },
    },
  },
}));
import { VerifyPhone } from "../VerifyPhone.js";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const ui = (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/verify-phone?next=%2Faccount"]}>
        <VerifyPhone />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...render(ui), ui };
}

describe("phone verification recovery", () => {
  beforeEach(() => {
    mocks.me.mockResolvedValue({
      id: 7,
      phone: "+15551234567",
      maskedPhone: "••••4567",
      phoneVerified: false,
    });
  });

  it("does not automatically retry failed SMS delivery on rerenders", async () => {
    mocks.request.mockRejectedValue(new Error("SMS delivery unavailable"));
    const { rerender, ui } = renderPage();
    await screen.findByRole("alert");
    rerender(ui);
    fireEvent.change(screen.getByLabelText("Six-digit SMS code"), {
      target: { value: "12" },
    });
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "SMS delivery unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2));
  });

  it("allows correcting the signup phone after delivery fails", async () => {
    mocks.request.mockRejectedValueOnce(new Error("SMS delivery unavailable"));
    renderPage();
    await screen.findByRole("alert");
    fireEvent.click(
      screen.getByRole("button", { name: "Use a different mobile number" }),
    );
    mocks.request.mockResolvedValue({
      alreadyVerified: false,
      maskedPhone: "••••4321",
    });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "+15557654321" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Send SMS verification code" }),
    );
    await screen.findByLabelText("Six-digit SMS code");
    expect(mocks.request).toHaveBeenLastCalledWith({ phone: "+15557654321" });
    expect(screen.getByText(/code sent to ••••4321/)).toBeInTheDocument();
  });
});

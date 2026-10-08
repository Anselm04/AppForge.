import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
const resend = vi.hoisted(() => vi.fn());
vi.mock("../lib/auth.js", () => ({
  resendVerification: resend,
  safeAuthDestination: (value: string) =>
    value?.startsWith("/") && !value.startsWith("//") ? value : "/",
}));
vi.mock("../components/auth/AuthShell.js", () => ({
  AuthShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
import { ResendVerification } from "../pages/ResendVerification.js";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resend.mockReset();
});
describe("confirmation recovery", () => {
  it("blocks simultaneous submits and enforces a 60 second cooldown", async () => {
    vi.useFakeTimers();
    let complete!: () => void;
    resend.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    render(
      <MemoryRouter
        initialEntries={[
          "/resend-verification?email=person%40example.com&next=%2Faccount",
        ]}
      >
        <ResendVerification />
      </MemoryRouter>,
    );
    const form = screen.getByLabelText("Email").closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(resend).toHaveBeenCalledTimes(1);
    expect(resend).toHaveBeenCalledWith("person@example.com", "/account");
    await act(async () => complete());
    fireEvent.submit(form);
    expect(resend).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(60_000));
    fireEvent.submit(form);
    expect(resend).toHaveBeenCalledTimes(2);
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "../Input.js";

describe("Input password visibility toggle", () => {
  it("starts concealed and lets the user reveal and re-hide the value", () => {
    render(
      <Input
        id="pw"
        label="Password"
        type="password"
        defaultValue="hunter2"
        showPasswordLabel="Show password"
        hidePasswordLabel="Hide password"
      />,
    );

    const field = screen.getByLabelText("Password") as HTMLInputElement;
    expect(field).toHaveAttribute("type", "password");

    const reveal = screen.getByRole("button", { name: "Show password" });
    expect(reveal).toHaveAttribute("aria-pressed", "false");
    expect(reveal).toHaveAttribute("aria-controls", "pw");

    fireEvent.click(reveal);

    expect(field).toHaveAttribute("type", "text");
    expect(field).toHaveValue("hunter2");

    const conceal = screen.getByRole("button", { name: "Hide password" });
    expect(conceal).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(conceal);

    expect(field).toHaveAttribute("type", "password");
  });

  it("keeps the reveal control off non-password fields", () => {
    render(
      <Input id="email" label="Email" type="email" defaultValue="a@b.com" />,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
  });

  it("falls back to English labels when no labels are supplied", () => {
    render(<Input id="pw-default" label="Password" type="password" />);

    expect(
      screen.getByRole("button", { name: "Show password" }),
    ).toBeInTheDocument();
  });
});

it("retains field focus when revealing and links error text to the input", () => {
  render(
    <Input
      id="focus-pw"
      label="Password"
      type="password"
      error="Password is required"
      aria-describedby="existing-help"
    />,
  );
  const field = screen.getByLabelText("Password");
  field.focus();
  fireEvent.mouseDown(screen.getByRole("button", { name: "Show password" }));
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(field).toHaveFocus();
  expect(field).toHaveAttribute("aria-invalid", "true");
  expect(field).toHaveAttribute(
    "aria-describedby",
    "existing-help focus-pw-error",
  );
  expect(screen.getByText("Password is required")).toHaveAttribute(
    "id",
    "focus-pw-error",
  );
});

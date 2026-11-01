import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BuildPromptComposer } from "../components/BuildPromptComposer.js";

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  delete (window as unknown as { webkitSpeechRecognition?: unknown })
    .webkitSpeechRecognition;
});

describe("BuildPromptComposer", () => {
  it("prefills the controlled prompt from a suggestion and submits through the supplied handler", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    render(
      <BuildPromptComposer
        value=""
        onChange={onChange}
        onSubmit={onSubmit}
        submitLabel="Build"
        placeholder="Describe your product"
        suggestions={["Build me a booking app"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Build me a booking app" }));
    expect(onChange).toHaveBeenCalledWith("Build me a booking app");

    fireEvent.submit(screen.getByTestId("build-prompt-form"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps typed input fully usable when browser speech recognition is unavailable", () => {
    const onChange = vi.fn();

    render(
      <BuildPromptComposer
        value=""
        onChange={onChange}
        onSubmit={vi.fn()}
        submitLabel="Build"
        placeholder="Describe your product"
      />,
    );

    const input = screen.getByRole("textbox", { name: "What do you want to build?" });
    fireEvent.change(input, { target: { value: "A simple customer portal" } });
    expect(onChange).toHaveBeenCalledWith("A simple customer portal");
    expect(
      screen.getByRole("button", { name: "Voice input unavailable" }),
    ).toBeDisabled();
  });

  it("passes recognized speech back through the controlled value callback", () => {
    let recognitionInstance: {
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      onresult: ((event: unknown) => void) | null;
      onend: (() => void) | null;
      onerror: (() => void) | null;
      continuous: boolean;
      interimResults: boolean;
      lang: string;
    } | null = null;

    class FakeRecognition {
      start = vi.fn();
      stop = vi.fn();
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      continuous = false;
      interimResults = false;
      lang = "";

      constructor() {
        recognitionInstance = this;
      }
    }

    (window as unknown as { SpeechRecognition: typeof FakeRecognition }).SpeechRecognition =
      FakeRecognition;

    const onChange = vi.fn();
    render(
      <BuildPromptComposer
        value="Existing idea"
        onChange={onChange}
        onSubmit={vi.fn()}
        submitLabel="Build"
        placeholder="Describe your product"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start voice input" }));
    expect(recognitionInstance?.start).toHaveBeenCalledTimes(1);

    recognitionInstance?.onresult?.({
      results: [[{ transcript: "with customer notifications" }]],
    });

    expect(onChange).toHaveBeenCalledWith(
      "Existing idea with customer notifications",
    );
  });
});

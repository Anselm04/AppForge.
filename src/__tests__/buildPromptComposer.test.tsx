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

    fireEvent.click(
      screen.getByRole("button", { name: "Build me a booking app" }),
    );
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

    const input = screen.getByRole("textbox", {
      name: "What do you want to build?",
    });
    fireEvent.change(input, { target: { value: "A simple customer portal" } });
    expect(onChange).toHaveBeenCalledWith("A simple customer portal");
    expect(
      screen.getByRole("button", { name: "Voice input unavailable" }),
    ).toBeDisabled();
  });

  it("passes recognized speech back through the controlled value callback", () => {
    class FakeRecognition {
      start = vi.fn();
      stop = vi.fn();
      onresult:
        | ((event: {
            results: Array<Array<{ transcript: string }>>;
          }) => void)
        | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      continuous = false;
      interimResults = false;
      lang = "";
    }

    const instances: FakeRecognition[] = [];
    class FakeRecognitionConstructor extends FakeRecognition {
      constructor() {
        super();
        instances.push(this);
      }
    }

    (
      window as unknown as {
        SpeechRecognition: typeof FakeRecognitionConstructor;
      }
    ).SpeechRecognition = FakeRecognitionConstructor;

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
    const recognition = instances[0];
    expect(recognition).toBeDefined();
    expect(recognition?.start).toHaveBeenCalledTimes(1);

    recognition?.onresult?.({
      results: [[{ transcript: "with customer notifications" }]],
    });

    expect(onChange).toHaveBeenCalledWith(
      "Existing idea with customer notifications",
    );
  });
});

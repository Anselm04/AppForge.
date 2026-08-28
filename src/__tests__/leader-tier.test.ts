import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  emitPreviewUpdate,
  onPreviewUpdate,
  PREVIEW_UPDATE_EVENT,
} from "../lib/previewEvents.js";
import { designSystemPrompt } from "../lib/componentLibrary.js";

describe("previewEvents", () => {
  it("dispatches and listens for preview updates", () => {
    const handler = vi.fn();
    const off = onPreviewUpdate(handler);
    emitPreviewUpdate(42, { paths: ["src/App.tsx"], source: "editor" });
    expect(handler).toHaveBeenCalledWith({
      projectId: 42,
      paths: ["src/App.tsx"],
      source: "editor",
    });
    off();
    emitPreviewUpdate(42);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("exports event name constant", () => {
    expect(PREVIEW_UPDATE_EVENT).toBe("appforge:preview-update");
  });
});

describe("designSystemPrompt", () => {
  it("includes v0 patterns and next hints", () => {
    const prompt = designSystemPrompt({
      stack: "next-node",
      locale: "fr",
      assetPaths: ["public/assets/logo.svg"],
    });
    expect(prompt).toMatch(/shadcn/i);
    expect(prompt).toMatch(/Next.js App Router/i);
    expect(prompt).toMatch(/logo.svg/);
    expect(prompt).toMatch(/locale "fr"/i);
  });
});

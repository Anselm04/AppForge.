import { describe, expect, it } from "vitest";
import {
  llmDeadlineSignal,
  llmRequestTimeoutMs,
} from "../lib/llmRequestDeadline.js";

describe("generation provider deadline without external API calls", () => {
  it("defaults to one minute and rejects invalid override", () => {
    expect(llmRequestTimeoutMs(undefined)).toBe(60_000);
    expect(llmRequestTimeoutMs("5000")).toBe(5_000);
    expect(llmRequestTimeoutMs("120000")).toBe(120_000);
    for (const value of ["0", "-1", "200000", "5.5", "NaN"]) {
      expect(() => llmRequestTimeoutMs(value)).toThrow(/5000..120000/);
    }
  });

  it("honors caller cancellation before any provider dispatch", () => {
    const controller = new AbortController();
    const signal = llmDeadlineSignal(controller.signal, 5_000);
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it("rejects corrupt deadlines rather than silently removing timeout", () => {
    expect(() => llmDeadlineSignal(undefined, 0)).toThrow(/positive integer/);
    expect(() => llmDeadlineSignal(undefined, Number.NaN)).toThrow(
      /positive integer/,
    );
  });
});

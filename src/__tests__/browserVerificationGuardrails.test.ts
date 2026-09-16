import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  analyzeRenderedDom,
  extractBrowserRuntimeErrors,
  isAllowedBrowserVerificationUrl,
} from "../services/browserVerification";

describe("real browser deployment verification", () => {
  it("only permits AppForge-owned Fly production targets", () => {
    expect(isAllowedBrowserVerificationUrl("https://af-demo-1234.fly.dev")).toBe(
      true,
    );
    expect(isAllowedBrowserVerificationUrl("http://af-demo.fly.dev")).toBe(false);
    expect(isAllowedBrowserVerificationUrl("https://fly.dev.evil.example")).toBe(
      false,
    );
    expect(isAllowedBrowserVerificationUrl("https://localhost.fly.dev:8443")).toBe(
      false,
    );
    expect(isAllowedBrowserVerificationUrl("https://127.0.0.1")).toBe(false);
  });

  it("accepts a JavaScript-rendered application body", () => {
    const result = analyzeRenderedDom(
      "<html><body><div id='root'><main><h1>Generated app</h1><button>Start</button></main></div></body></html>",
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects an unrendered SPA shell", () => {
    const result = analyzeRenderedDom(
      "<html><body><div id='root'></div><script src='/assets/app.js'></script></body></html>",
    );
    expect(result.ok).toBe(false);
    expect(result.error).toContain("empty application body");
  });

  it("rejects browser-visible fatal application failures", () => {
    expect(
      analyzeRenderedDom(
        "<html><body><main>Application Error: failed to initialize</main></body></html>",
      ).ok,
    ).toBe(false);
    expect(
      analyzeRenderedDom(
        "<html><body><vite-error-overlay>broken</vite-error-overlay></body></html>",
      ).ok,
    ).toBe(false);
  });

  it("extracts uncaught JavaScript errors without treating normal Chromium logs as failures", () => {
    const errors = extractBrowserRuntimeErrors(
      [
        "[INFO:CONSOLE(10)] Console message",
        "[INFO:CONSOLE(12)] Uncaught TypeError: cannot read properties of undefined",
        "DevTools listening on ws://127.0.0.1/devtools/browser/example",
      ].join("\n"),
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Uncaught TypeError");
  });

  it("keeps the HTTP smoke gate and then requires the real browser gate before deployment succeeds", () => {
    const source = readFileSync(
      new URL("../services/productionAutoDeploy.ts", import.meta.url),
      "utf8",
    );
    const httpGate = source.indexOf("runPostDeploySmokeTest(liveUrl)");
    const browserGate = source.indexOf("verifyGeneratedAppInBrowser(liveUrl)");
    const successReturn = source.indexOf("return { liveUrl }");

    expect(httpGate).toBeGreaterThan(-1);
    expect(browserGate).toBeGreaterThan(httpGate);
    expect(successReturn).toBeGreaterThan(browserGate);
  });

  it("ships Chromium in the AppForge production runtime", () => {
    const dockerfile = readFileSync(
      new URL("../../Dockerfile", import.meta.url),
      "utf8",
    );
    expect(dockerfile).toMatch(/apk add --no-cache[^\n]*chromium/);
    expect(dockerfile).toContain("APPFORGE_CHROMIUM_PATH");
  });
});

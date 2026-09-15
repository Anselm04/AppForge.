import { describe, expect, it } from "vitest";
import { applyStaticHtmlVisualEdit } from "../lib/visualHtmlEditor.js";
import { injectVisualPreviewBridge } from "../lib/visualPreviewBridge.js";

describe("static HTML visual editor", () => {
  it("updates simple text and whitelisted inline styles by unique id", () => {
    const html = '<main><h1 id="hero" style="color: red">Old</h1></main>';
    const result = applyStaticHtmlVisualEdit(html, {
      targetId: "hero",
      text: "New <safe> & text",
      styles: { color: "#112233", fontSize: "32px" },
    });
    expect(result).toContain('id="hero"');
    expect(result).toContain("color: #112233");
    expect(result).toContain("font-size: 32px");
    expect(result).toContain("New &lt;safe&gt; &amp; text");
  });

  it("rejects ambiguous ids, nested text replacement and unsafe CSS", () => {
    expect(() =>
      applyStaticHtmlVisualEdit('<p id="x">A</p><p id="x">B</p>', {
        targetId: "x",
        text: "C",
      }),
    ).toThrow("not unique");
    expect(() =>
      applyStaticHtmlVisualEdit('<div id="box"><span>Nested</span></div>', {
        targetId: "box",
        text: "Replace",
      }),
    ).toThrow("without nested markup");
    expect(() =>
      applyStaticHtmlVisualEdit('<div id="box">Text</div>', {
        targetId: "box",
        styles: { color: "red; background:url(javascript:alert(1))" },
      }),
    ).toThrow("Unsafe CSS value");
  });

  it("injects the sandbox bridge once before the closing body", () => {
    const html = '<!doctype html><html><body><p id="x">Hi</p></body></html>';
    const once = injectVisualPreviewBridge(html);
    const twice = injectVisualPreviewBridge(once);
    expect(once).toContain("data-appforge-visual-bridge");
    expect(once.indexOf("data-appforge-visual-bridge")).toBeLessThan(
      once.toLowerCase().indexOf("</body>"),
    );
    expect(twice).toBe(once);
  });
});

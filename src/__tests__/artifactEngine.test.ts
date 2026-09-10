import { describe, expect, it } from "vitest";
import {
  createCsv,
  createDocumentHtml,
  createPresentationHtml,
  createSimplePdf,
  sanitizeArtifactName,
} from "../services/artifactEngine.js";

describe("artifact engine", () => {
  it("sanitizes filenames and removes path traversal characters", () => {
    expect(sanitizeArtifactName("../../Quarterly Report", "artifact")).toBe(
      "Quarterly-Report",
    );
  });

  it("creates RFC-style quoted CSV cells", () => {
    const csv = createCsv(
      ["Name", "Notes"],
      [
        ["AppForge", "one,two"],
        ["TrillionAI", 'He said "ship it"'],
      ],
    );
    expect(csv).toContain('AppForge,"one,two"');
    expect(csv).toContain('TrillionAI,"He said ""ship it"""');
  });

  it("escapes document HTML instead of executing supplied markup", () => {
    const html = createDocumentHtml({
      title: "<script>alert(1)</script>",
      content: "Hello <img src=x onerror=alert(1)>",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("creates self-contained presentation HTML with escaped content", () => {
    const html = createPresentationHtml({
      title: "Launch Deck",
      slides: [
        {
          title: "Launch <Now>",
          body: "Ready & verified",
          bullets: ["Build", "Market", "Measure"],
        },
      ],
    });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Launch &lt;Now&gt;");
    expect(html).toContain("Ready &amp; verified");
  });

  it("creates a valid PDF envelope with a cross-reference table", () => {
    const pdf = createSimplePdf({
      title: "AppForge Report",
      lines: ["Production verification", "Second line"],
    });
    const text = pdf.toString("utf8");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("xref");
    expect(text.endsWith("%%EOF\n")).toBe(true);
  });
});

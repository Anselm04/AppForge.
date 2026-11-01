import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../components/BuildLivePreview.tsx", import.meta.url),
  "utf8",
);

describe("BuildLivePreview customer-facing contract", () => {
  it("keeps the secure iframe sandbox while using clear preview action wording", () => {
    expect(source).toContain(
      'sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"',
    );
    expect(source).toContain("Open preview");
    expect(source).toContain("Refresh");
    expect(source).toContain("LIVE PREVIEW");
  });
});

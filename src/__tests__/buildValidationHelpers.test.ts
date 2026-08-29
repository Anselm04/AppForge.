import { describe, expect, it } from "vitest";
import {
  buildEditContextSample,
  selectFilesForEditContext,
} from "../lib/buildValidationHelpers.js";
import {
  GOLDEN_STACKS,
  PRODUCTION_READY_CAPABILITIES,
  PRODUCTION_READY_STACK,
  INCOME_READY_CAPABILITIES,
  INCOME_READY_STACK,
} from "../lib/productionPreset.js";

describe("buildValidationHelpers", () => {
  it("prioritizes paths mentioned in the edit request", () => {
    const files = {
      "src/App.tsx": "export default function App() {}",
      "src/components/Hero.tsx": "export function Hero() {}",
      "README.md": "# doc",
    };
    const picked = selectFilesForEditContext("update Hero component", files, 2);
    expect(picked).toContain("src/components/Hero.tsx");
  });

  it("builds context samples for quick edit", () => {
    const sample = buildEditContextSample(
      "fix login",
      { "src/pages/Login.tsx": "export {}" },
      5,
    );
    expect(sample[0]).toContain("Login.tsx");
  });
});

describe("productionPreset", () => {
  it("defines golden stacks and production preset", () => {
    expect(GOLDEN_STACKS.length).toBeGreaterThanOrEqual(8);
    expect(PRODUCTION_READY_STACK).toBe("next-node");
    expect(PRODUCTION_READY_CAPABILITIES).toContain("web_search");
    expect(INCOME_READY_STACK).toBe("next-node");
    expect(INCOME_READY_CAPABILITIES).toContain("fintech");
  });
});

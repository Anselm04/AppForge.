import { describe, expect, it } from "vitest";
import {
  DESIGN_FAMILIES,
  DESIGN_FAMILY_RESOURCES,
  selectDesignFamilies,
} from "../designFamilies.js";

describe("Builder Resource design families", () => {
  it("offers multiple adaptable visual families instead of one cookie-cutter style", () => {
    expect(DESIGN_FAMILIES.map((family) => family.id)).toEqual([
      "product-neutral",
      "dense-dashboard",
      "editorial-content",
      "immersive-media",
    ]);
    expect(new Set(DESIGN_FAMILIES.map((family) => family.density)).size).toBeGreaterThan(1);
  });

  it("requires accessibility, responsive, light/dark and localization support in every family", () => {
    for (const family of DESIGN_FAMILIES) {
      expect(family.layout.minTouchTarget).toBeGreaterThanOrEqual(44);
      expect(family.accessibility.minimumContrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(family.accessibility.keyboardNavigation).toBe(true);
      expect(family.accessibility.screenReaderSemantics).toBe(true);
      expect(family.themes.light).toBe(true);
      expect(family.themes.dark).toBe(true);
      expect(family.localization.rtl).toBe(true);
      expect(family.localization.expansionSafe).toBe(true);
    }
  });

  it("selects by product intent while preserving branding hooks", () => {
    expect(selectDesignFamilies({ prefersDenseInformation: true })[0]?.id).toBe(
      "dense-dashboard",
    );
    expect(selectDesignFamilies({ contentHeavy: true })[0]?.id).toBe(
      "editorial-content",
    );
    expect(selectDesignFamilies({ immersive: true })[0]?.id).toBe(
      "immersive-media",
    );
    expect(
      DESIGN_FAMILY_RESOURCES.every(
        (resource) => resource.adaptation.brandingHooks.length > 0,
      ),
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { ALL_BUILDER_RESOURCES } from "../builderResourceLibrary.js";
import { COMPONENT_RESOURCES } from "../componentResources.js";
import { BUILDER_RESOURCE_ATOMS, dateRangeAtomSchema } from "../resourceAtoms.js";

describe("five-level Builder Resource Library", () => {
  it("contains real resources at atom, component, module, domain-pack and reference-architecture levels", () => {
    const types = new Set(
      ALL_BUILDER_RESOURCES.map((resource) => resource.identity.resourceType),
    );
    expect(types).toEqual(
      new Set([
        "atom",
        "component",
        "module",
        "domain_pack",
        "reference_architecture",
      ]),
    );
  });

  it("contains validated atoms rather than empty names", () => {
    expect(BUILDER_RESOURCE_ATOMS.length).toBeGreaterThanOrEqual(8);
    expect(
      dateRangeAtomSchema.safeParse({
        start: "2026-10-16T10:00:00.000Z",
        end: "2026-10-16T09:00:00.000Z",
        timezone: "Pacific/Auckland",
      }).success,
    ).toBe(false);
  });

  it("contains adaptable component contracts for common product workflows", () => {
    const ids = COMPONENT_RESOURCES.map((resource) => resource.identity.resourceId);
    expect(ids).toEqual(
      expect.arrayContaining([
        "component.login-form",
        "component.profile-editor",
        "component.pricing-card",
        "component.search-box",
        "component.file-uploader",
        "component.data-table",
        "component.booking-selector",
        "component.data-chart",
      ]),
    );
    expect(
      COMPONENT_RESOURCES.every(
        (resource) => resource.adaptation.configurableFields.length > 0,
      ),
    ).toBe(true);
  });
});

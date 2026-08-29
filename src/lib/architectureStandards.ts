/** Jurisdiction metadata for architecture, planning, and building-code workflows. */

export type ArchitectureJurisdiction =
  "US" | "UK" | "EU" | "AU" | "NZ" | "CA" | "SG" | "AE" | "IN" | "OTHER";

export type UnitSystem = "metric" | "imperial";

export type ProjectPhase =
  | "pre_design"
  | "concept"
  | "schematic"
  | "design_development"
  | "construction_documents"
  | "construction_admin"
  | "handover";

export type JurisdictionMeta = {
  id: ArchitectureJurisdiction;
  label: string;
  buildingCode: string;
  planningAuthority: string;
  accessibilityStandard: string;
  fireStandard: string;
  defaultUnits: UnitSystem;
  permitNotes: string;
};

export const ARCHITECTURE_JURISDICTIONS: Record<
  ArchitectureJurisdiction,
  JurisdictionMeta
> = {
  US: {
    id: "US",
    label: "United States",
    buildingCode: "IBC / local amendments",
    planningAuthority: "City/county planning department",
    accessibilityStandard: "ADA / ICC A117.1",
    fireStandard: "NFPA 101 / IBC Chapter 10",
    defaultUnits: "imperial",
    permitNotes:
      "Submit site plan, floor plans, elevations, sections, energy compliance (IECC), and structural calcs per jurisdiction.",
  },
  UK: {
    id: "UK",
    label: "United Kingdom",
    buildingCode: "Building Regulations (Approved Documents)",
    planningAuthority: "Local planning authority (LPA)",
    accessibilityStandard: "Part M / BS 8300",
    fireStandard: "Part B / BS 9999",
    defaultUnits: "metric",
    permitNotes:
      "Planning permission + Building Control submission; include fire strategy and accessibility statement.",
  },
  EU: {
    id: "EU",
    label: "European Union (generic)",
    buildingCode: "Eurocodes + national annexes",
    planningAuthority: "Municipal planning office",
    accessibilityStandard: "EN 17210",
    fireStandard: "National fire codes + EN standards",
    defaultUnits: "metric",
    permitNotes:
      "Energy performance certificate, accessibility, and fire safety strategy required in most member states.",
  },
  AU: {
    id: "AU",
    label: "Australia",
    buildingCode: "NCC (National Construction Code)",
    planningAuthority: "Council / DA process",
    accessibilityStandard: "AS 1428 / DDA",
    fireStandard: "NCC Section C / AS 1851",
    defaultUnits: "metric",
    permitNotes:
      "Development application with BASIX/NatHERS energy, bushfire (if applicable), and accessibility compliance.",
  },
  NZ: {
    id: "NZ",
    label: "New Zealand",
    buildingCode: "Building Code (NZBC)",
    planningAuthority: "Territorial authority (resource consent)",
    accessibilityStandard: "NZS 4121",
    fireStandard: "C/AS2–C/AS7 acceptable solutions",
    defaultUnits: "metric",
    permitNotes:
      "Building consent + resource consent where applicable; producer statements for structural/MEP.",
  },
  CA: {
    id: "CA",
    label: "Canada",
    buildingCode: "National Building Code + provincial codes",
    planningAuthority: "Municipal planning / zoning",
    accessibilityStandard: "CSA B651 / provincial accessibility acts",
    fireStandard: "NBC Part 3 / NFPA references",
    defaultUnits: "metric",
    permitNotes:
      "Development permit + building permit; energy step code in many provinces.",
  },
  SG: {
    id: "SG",
    label: "Singapore",
    buildingCode: "Building Control Act / SS codes",
    planningAuthority: "URA / BCA",
    accessibilityStandard: "SS 556 / Code on Accessibility",
    fireStandard: "SCDF Fire Code",
    defaultUnits: "metric",
    permitNotes: "Planning permission + building plan submission to BCA.",
  },
  AE: {
    id: "AE",
    label: "United Arab Emirates",
    buildingCode: "Abu Dhabi / Dubai / UAE Fire & Life Safety Code",
    planningAuthority: "Municipal authority (DDA, ADM, etc.)",
    accessibilityStandard: "Local accessibility guidelines",
    fireStandard: "UAE Fire and Life Safety Code",
    defaultUnits: "metric",
    permitNotes:
      "NOC from civil defence, DEWA/ADDC utilities, and municipality approvals.",
  },
  IN: {
    id: "IN",
    label: "India",
    buildingCode: "NBC 2016 + state bylaws",
    planningAuthority: "Municipal corporation / development authority",
    accessibilityStandard: "Harmonised Guidelines (UDID)",
    fireStandard: "NBC Part 4 / local fire NOC",
    defaultUnits: "metric",
    permitNotes:
      "Sanction plan with FAR/FSI compliance, fire NOC, and environmental clearance where required.",
  },
  OTHER: {
    id: "OTHER",
    label: "Other / specify in brief",
    buildingCode: "Local building code (research required)",
    planningAuthority: "Local council or authority",
    accessibilityStandard: "Local accessibility standard",
    fireStandard: "Local fire/life-safety code",
    defaultUnits: "metric",
    permitNotes:
      "Use live web research for current setbacks, height limits, and permit checklists.",
  },
};

export const ARCHITECTURE_PHASES: { id: ProjectPhase; label: string }[] = [
  { id: "pre_design", label: "Pre-design & briefing" },
  { id: "concept", label: "Concept & schematic design" },
  { id: "schematic", label: "Schematic design" },
  { id: "design_development", label: "Design development (BIM)" },
  { id: "construction_documents", label: "Construction documents" },
  { id: "construction_admin", label: "Construction administration" },
  { id: "handover", label: "Handover & post-occupancy" },
];

export const ARCHITECTURE_LEGAL_DISCLAIMER =
  "AppForge architecture outputs are design aids only — not stamped professional documents. Licensed architects, engineers, and local authorities must review and approve all submissions.";

export function resolveUnits(
  jurisdiction: ArchitectureJurisdiction,
  override?: UnitSystem,
): UnitSystem {
  return override ?? ARCHITECTURE_JURISDICTIONS[jurisdiction].defaultUnits;
}

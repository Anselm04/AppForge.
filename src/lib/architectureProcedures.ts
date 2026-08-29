/**
 * Architecture delivery procedures — additive rewrite of the architecture-studio branch intent.
 * Formal phase registry + agent prompt injection. Does not replace ArchitectureStudio or existing libs.
 */

import {
  ARCHITECTURE_JURISDICTIONS,
  ARCHITECTURE_LEGAL_DISCLAIMER,
  ARCHITECTURE_PHASES,
  type ArchitectureJurisdiction,
  type ProjectPhase,
} from "./architectureStandards.js";

export type ArchitectureProcedureId =
  | "zoning_research"
  | "brief_feasibility"
  | "concept_schematic"
  | "sustainability"
  | "bim_coordinate"
  | "clash_detection"
  | "accessibility"
  | "construction_docs"
  | "permit_pack"
  | "bill_of_quantities"
  | "specifications"
  | "construction_admin"
  | "snagging"
  | "post_occupancy";

export type ArchitectureProcedure = {
  id: ArchitectureProcedureId;
  label: string;
  phase: ProjectPhase;
  description: string;
  requires: ArchitectureProcedureId[];
  trpcProcedure: string;
};

/** Ordered delivery stack from pre-design through handover. */
export const ARCHITECTURE_PROCEDURES: ArchitectureProcedure[] = [
  {
    id: "zoning_research",
    label: "Zoning & code research",
    phase: "pre_design",
    description: "Live research of setbacks, height limits, and local codes.",
    requires: [],
    trpcProcedure: "researchArchitectureZoning",
  },
  {
    id: "brief_feasibility",
    label: "Brief & feasibility",
    phase: "pre_design",
    description: "Structured client brief, program, and feasibility summary.",
    requires: [],
    trpcProcedure: "generateArchitectureBrief",
  },
  {
    id: "concept_schematic",
    label: "Concept & schematic",
    phase: "concept",
    description: "Massing, floor plans, and schematic elevations.",
    requires: ["brief_feasibility"],
    trpcProcedure: "generateConceptDesign",
  },
  {
    id: "sustainability",
    label: "Sustainability report",
    phase: "schematic",
    description: "Energy, materials, and environmental strategy.",
    requires: ["concept_schematic"],
    trpcProcedure: "generateSustainabilityReport",
  },
  {
    id: "bim_coordinate",
    label: "Coordinated BIM",
    phase: "design_development",
    description: "Architectural + structural + MEP model coordination.",
    requires: ["concept_schematic"],
    trpcProcedure: "generateBIMModel",
  },
  {
    id: "clash_detection",
    label: "Clash detection",
    phase: "design_development",
    description: "Cross-discipline bounding-box clash scan.",
    requires: ["bim_coordinate"],
    trpcProcedure: "detectBIMClashes",
  },
  {
    id: "accessibility",
    label: "Accessibility compliance",
    phase: "design_development",
    description: "Door, corridor, and egress heuristics.",
    requires: ["concept_schematic"],
    trpcProcedure: "checkArchitectureAccessibility",
  },
  {
    id: "construction_docs",
    label: "Construction documents",
    phase: "construction_documents",
    description: "Drawing set outline for construction.",
    requires: ["bim_coordinate"],
    trpcProcedure: "generateConstructionDocuments",
  },
  {
    id: "permit_pack",
    label: "Permit application pack",
    phase: "construction_documents",
    description: "Jurisdiction-aware permit checklist and drawing list.",
    requires: ["construction_docs"],
    trpcProcedure: "generatePermitDrawings",
  },
  {
    id: "bill_of_quantities",
    label: "Bill of quantities",
    phase: "construction_documents",
    description: "Quantity takeoff from BIM elements.",
    requires: ["bim_coordinate"],
    trpcProcedure: "generateBillOfQuantities",
  },
  {
    id: "specifications",
    label: "Specifications",
    phase: "construction_documents",
    description: "Material and workmanship specifications.",
    requires: ["construction_docs"],
    trpcProcedure: "generateArchitectureSpecifications",
  },
  {
    id: "construction_admin",
    label: "Construction administration",
    phase: "construction_admin",
    description: "Submittals, RFIs, and change-order templates.",
    requires: ["construction_docs"],
    trpcProcedure: "generateConstructionAdminPack",
  },
  {
    id: "snagging",
    label: "Snagging / defects",
    phase: "handover",
    description: "Defects list by area for practical completion.",
    requires: ["construction_admin"],
    trpcProcedure: "generateSnaggingList",
  },
  {
    id: "post_occupancy",
    label: "Post-occupancy plan",
    phase: "handover",
    description: "Post-occupancy evaluation and maintenance plan.",
    requires: ["snagging"],
    trpcProcedure: "generatePostOccupancyPlan",
  },
];

export function proceduresForPhase(phase: ProjectPhase): ArchitectureProcedure[] {
  return ARCHITECTURE_PROCEDURES.filter((p) => p.phase === phase);
}

export function nextProcedures(
  completed: ArchitectureProcedureId[],
): ArchitectureProcedure[] {
  const done = new Set(completed);
  return ARCHITECTURE_PROCEDURES.filter(
    (p) => !done.has(p.id) && p.requires.every((r) => done.has(r)),
  );
}

/** Inject into Planner/Coder when architecture capability is enabled. */
export function architectureAgentPrompt(
  jurisdiction: ArchitectureJurisdiction = "OTHER",
): string {
  const meta = ARCHITECTURE_JURISDICTIONS[jurisdiction];
  const phases = ARCHITECTURE_PHASES.map((p) => `- ${p.label}`).join("\n");
  const procs = ARCHITECTURE_PROCEDURES.map(
    (p) => `- ${p.label} (${p.phase}): ${p.description}`,
  ).join("\n");
  return `
--- ARCHITECTURE DELIVERY STACK ---
Jurisdiction: ${meta.label}
Building code: ${meta.buildingCode}
Planning: ${meta.planningAuthority}
Accessibility: ${meta.accessibilityStandard}
Fire: ${meta.fireStandard}
Default units: ${meta.defaultUnits}
Permit notes: ${meta.permitNotes}

Project phases:
${phases}

Procedures (run in dependency order):
${procs}

${ARCHITECTURE_LEGAL_DISCLAIMER}
--- END ARCHITECTURE DELIVERY STACK ---
`.trim();
}

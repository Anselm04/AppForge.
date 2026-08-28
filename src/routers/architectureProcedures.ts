import { z } from "zod";
import { protectedProcedure } from "../_core/trpc.js";
import { invokeLLM } from "../_core/llm.js";
import { modelForAgent } from "../lib/llmModels.js";
import { searchWeb } from "../services/webSearch.js";
import {
  ARCHITECTURE_JURISDICTIONS,
  resolveUnits,
  type ArchitectureJurisdiction,
} from "../lib/architectureStandards.js";

const jurisdictionEnum = z.enum([
  "US",
  "UK",
  "EU",
  "AU",
  "NZ",
  "CA",
  "SG",
  "AE",
  "IN",
  "OTHER",
]);

function parseLlmJson(text: string): Record<string, unknown> {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
  } catch {
    return { raw: text };
  }
}

async function llmJson(
  system: string,
  user: string,
  agent: "planner" | "coder" = "planner",
): Promise<Record<string, unknown>> {
  const result = await invokeLLM({
    model: modelForAgent(agent),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const text =
    typeof result.choices[0]?.message?.content === "string"
      ? result.choices[0].message.content
      : "";
  return parseLlmJson(text);
}

function jurisdictionContext(j: ArchitectureJurisdiction, location: string) {
  const meta = ARCHITECTURE_JURISDICTIONS[j];
  return `Jurisdiction: ${meta.label} (${location})\nBuilding code: ${meta.buildingCode}\nPlanning: ${meta.planningAuthority}\nAccessibility: ${meta.accessibilityStandard}\nFire: ${meta.fireStandard}\nPermit notes: ${meta.permitNotes}`;
}

/** Architecture studio tRPC procedures — merged into capabilitiesRouter. */
export const architectureProcedures = {
  researchArchitectureZoning: protectedProcedure
    .input(
      z.object({
        location: z.string().min(2).max(300),
        projectType: z.string().max(200).default("residential"),
        jurisdiction: jurisdictionEnum.default("OTHER"),
      }),
    )
    .mutation(async ({ input }) => {
      const meta = ARCHITECTURE_JURISDICTIONS[input.jurisdiction];
      const query = `${input.location} ${input.projectType} zoning setbacks height limits building code planning permission ${meta.buildingCode} 2026`;
      return searchWeb(query, 8);
    }),

  generateArchitectureBrief: protectedProcedure
    .input(
      z.object({
        brief: z.string().min(10).max(8000),
        location: z.string().min(2).max(300),
        jurisdiction: jurisdictionEnum.default("OTHER"),
        units: z.enum(["metric", "imperial"]).optional(),
        budgetUsd: z.number().positive().optional(),
        siteNotes: z.string().max(4000).optional(),
        zoningResearch: z.string().max(12000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const units = resolveUnits(input.jurisdiction, input.units);
      const ctx = jurisdictionContext(input.jurisdiction, input.location);
      return llmJson(
        `You are a senior architect. Produce pre-design deliverables in ${units} units.\nOutput JSON: {\n  clientBrief: { goals, constraints, stakeholders, successCriteria },\n  siteAnalysis: { topography, orientation, climate, access, existingConditions },\n  feasibility: { viable, risks, opportunities, recommendations },\n  budgetStrategy: { estimatedCostRange, costDrivers, phasing, contingencyPercent },\n  projectViability: { score, summary }\n}`,
        `${ctx}\nBrief: ${input.brief}\nSite notes: ${input.siteNotes ?? "none"}\nBudget USD: ${input.budgetUsd ?? "TBD"}\nZoning research:\n${input.zoningResearch ?? "none"}`,
      );
    }),

  generateConceptDesign: protectedProcedure
    .input(
      z.object({
        brief: z.string().min(10).max(8000),
        location: z.string().min(2).max(300),
        jurisdiction: jurisdictionEnum.default("OTHER"),
        units: z.enum(["metric", "imperial"]).optional(),
        floors: z.number().int().min(1).max(80).default(2),
        buildingType: z.string().max(100).default("mixed-use"),
      }),
    )
    .mutation(async ({ input }) => {
      const units = resolveUnits(input.jurisdiction, input.units);
      return llmJson(
        `Architectural concept designer. Output JSON in ${units}:\n{\n  massing: { form, height, footprint, storeys },\n  floorPlans: [{ level, rooms: [{ id, name, type, x, y, width, height, doorWidthMm }] }],\n  materials: [{ zone, exterior, interior, rationale }],\n  aestheticNotes: string,\n  renderPrompts: [string]\n}`,
        `Location: ${input.location}\nType: ${input.buildingType}\nFloors: ${input.floors}\nBrief:\n${input.brief}`,
      );
    }),

  generateSustainabilityReport: protectedProcedure
    .input(
      z.object({
        conceptDesign: z.record(z.unknown()),
        location: z.string().min(2).max(300),
        jurisdiction: jurisdictionEnum.default("OTHER"),
      }),
    )
    .mutation(async ({ input }) => {
      const meta = ARCHITECTURE_JURISDICTIONS[input.jurisdiction];
      return llmJson(
        `Sustainability consultant. Output JSON:\n{\n  passiveDesign: [string],\n  insulationStrategy: { walls, roof, glazing, uValues },\n  solarOrientation: { optimal, current, recommendations },\n  energyPerformance: { estimatedEUI, rating, certifications },\n  waterStrategy: [string],\n  carbonNotes: string\n}`,
        `${meta.label} — ${input.location}\nConcept:\n${JSON.stringify(input.conceptDesign, null, 2)}`,
      );
    }),

  generateBIMModel: protectedProcedure
    .input(
      z.object({
        conceptDesign: z.record(z.unknown()),
        location: z.string().min(2).max(300),
        includeStructural: z.boolean().default(true),
        includeMEP: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      return llmJson(
        `BIM coordinator (Revit/ArchiCAD level). Output coordinated JSON model:\n{\n  modelVersion: string,\n  levels: [{ id, name, elevation }],\n  elements: [{ id, discipline, type, label, levelId, x, y, z, width, height, depth }],\n  structural: { foundations, framing, loadPaths: [string] },\n  mep: { mechanical, electrical, plumbing: [{ system, elements: [string] }] },\n  views: { plans: [string], sections: [string], elevations: [string] }\n}`,
        `Location: ${input.location}\nStructural: ${input.includeStructural}\nMEP: ${input.includeMEP}\nConcept:\n${JSON.stringify(input.conceptDesign, null, 2)}`,
        "coder",
      );
    }),

  detectBIMClashes: protectedProcedure
    .input(
      z.object({
        bimModel: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ input }) => {
      const { detectBimClashes } =
        await import("../lib/architectureClashCheck.js");
      const elements = (input.bimModel.elements ?? []) as Array<{
        id: string;
        discipline:
          | "architectural"
          | "structural"
          | "mechanical"
          | "electrical"
          | "plumbing";
        type: string;
        label?: string;
        x: number;
        y: number;
        z?: number;
        width?: number;
        height?: number;
        depth?: number;
      }>;
      return detectBimClashes(elements);
    }),

  generateConstructionDocuments: protectedProcedure
    .input(
      z.object({
        bimModel: z.record(z.unknown()),
        jurisdiction: jurisdictionEnum.default("OTHER"),
        units: z.enum(["metric", "imperial"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const units = resolveUnits(input.jurisdiction, input.units);
      const meta = ARCHITECTURE_JURISDICTIONS[input.jurisdiction];
      return llmJson(
        `Produce construction document set in ${units} for ${meta.label}. Output JSON:\n{\n  sheetIndex: [{ number, title, scale }],\n  floorPlans: [{ sheet, level, notes }],\n  elevations: [{ sheet, facing, notes }],\n  sections: [{ sheet, cut, notes }],\n  schedules: { doors: [], windows: [], finishes: [] },\n  structuralDetails: [{ ref, description }],\n  fireStrategy: { compartments, egress, alarms },\n  accessibilityNotes: [string]\n}`,
        JSON.stringify(input.bimModel, null, 2),
        "coder",
      );
    }),

  checkArchitectureAccessibility: protectedProcedure
    .input(
      z.object({
        floorPlan: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ input }) => {
      const { checkAccessibilityCompliance } =
        await import("../lib/architectureComplianceCheck.js");
      const rooms = (input.floorPlan.rooms ?? []) as Array<{
        id: string;
        name: string;
        type: string;
        areaSqM?: number;
        doorWidthMm?: number;
        hasRamp?: boolean;
      }>;
      return checkAccessibilityCompliance({
        rooms,
        corridorWidthMm: input.floorPlan.corridorWidthMm as number | undefined,
        egressDoorCount: input.floorPlan.egressDoorCount as number | undefined,
        floorAreaSqM: input.floorPlan.floorAreaSqM as number | undefined,
      });
    }),

  generateAcousticAnalysis: protectedProcedure
    .input(
      z.object({
        buildingType: z.string().min(3).max(200),
        rooms: z.array(z.string()).max(40).default([]),
        jurisdiction: jurisdictionEnum.default("OTHER"),
      }),
    )
    .mutation(async ({ input }) => {
      return llmJson(
        `Acoustic consultant. Output JSON:\n{\n  criteria: [{ space, targetRT60, targetNC, standard }],\n  partitions: [{ between, stcRating, notes }],\n  recommendations: [string],\n  criticalSpaces: [string]\n}`,
        `Type: ${input.buildingType}\nRooms: ${input.rooms.join(", ") || "general"}\nJurisdiction: ${input.jurisdiction}`,
      );
    }),

  generateLandscapePlan: protectedProcedure
    .input(
      z.object({
        siteBrief: z.string().min(5).max(4000),
        climate: z.string().max(100).default("temperate"),
        units: z.enum(["metric", "imperial"]).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return llmJson(
        `Landscape architect. Output JSON:\n{\n  grading: { strategy, drainage, cutFillNotes },\n  hardscape: [{ zone, material, area }],\n  planting: [{ zone, species, density, irrigation }],\n  sitePlanNotes: [string],\n  outdoorAmenities: [string]\n}`,
        `Climate: ${input.climate}\nUnits: ${input.units ?? "metric"}\nBrief:\n${input.siteBrief}`,
      );
    }),

  generateInteriorLayout: protectedProcedure
    .input(
      z.object({
        floorPlan: z.record(z.unknown()),
        style: z.string().max(100).default("contemporary"),
        budgetTier: z.enum(["economy", "mid", "premium"]).default("mid"),
      }),
    )
    .mutation(async ({ input }) => {
      return llmJson(
        `Interior designer. Output JSON:\n{\n  zones: [{ room, furniture: [{ item, dimensions, placement }], fixtures: [string], finishes: { floor, walls, ceiling } }],\n  ffAndE: [{ item, qty, spec }],\n  moodBoard: { palette, materials, lighting },\n  notes: [string]\n}`,
        `Style: ${input.style}\nBudget: ${input.budgetTier}\nFloor plan:\n${JSON.stringify(input.floorPlan, null, 2)}`,
      );
    }),

  generatePermitDrawings: protectedProcedure
    .input(
      z.object({
        constructionDocs: z.record(z.unknown()),
        jurisdiction: jurisdictionEnum.default("OTHER"),
        councilName: z.string().max(200).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const meta = ARCHITECTURE_JURISDICTIONS[input.jurisdiction];
      return llmJson(
        `Permit application specialist for ${meta.label}. Output JSON:\n{\n  applicationChecklist: [string],\n  requiredSheets: [{ name, purpose, format }],\n  coverSheetNotes: string,\n  complianceStatements: { zoning, accessibility, fire, energy },\n  submissionNotes: [string]\n}`,
        `Council: ${input.councilName ?? meta.planningAuthority}\nPermit notes: ${meta.permitNotes}\nDocs:\n${JSON.stringify(input.constructionDocs, null, 2)}`,
      );
    }),

  generateBillOfQuantities: protectedProcedure
    .input(
      z.object({
        bimModel: z.record(z.unknown()),
        units: z.enum(["metric", "imperial"]).optional(),
        currency: z.string().max(10).default("USD"),
      }),
    )
    .mutation(async ({ input }) => {
      return llmJson(
        `Quantity surveyor. Output JSON:\n{\n  currency: string,\n  lineItems: [{ code, description, unit, quantity, unitRate, total }],\n  subtotals: { structure, envelope, mep, interiors, external },\n  contingencyPercent: number,\n  grandTotal: number,\n  assumptions: [string]\n}`,
        `Currency: ${input.currency}\nUnits: ${input.units ?? "metric"}\nModel:\n${JSON.stringify(input.bimModel, null, 2)}`,
        "coder",
      );
    }),

  generateArchitectureSpecifications: protectedProcedure
    .input(
      z.object({
        constructionDocs: z.record(z.unknown()),
        jurisdiction: jurisdictionEnum.default("OTHER"),
      }),
    )
    .mutation(async ({ input }) => {
      const meta = ARCHITECTURE_JURISDICTIONS[input.jurisdiction];
      return llmJson(
        `Specification writer (CSI/Masterspec style) for ${meta.label}. Output JSON:\n{\n  divisions: [{ number, title, sections: [{ number, title, content }] }],\n  materialStandards: [{ material, standard, manufacturer }],\n  executionNotes: [string],\n  qualityAssurance: [string]\n}`,
        JSON.stringify(input.constructionDocs, null, 2),
        "coder",
      );
    }),

  generateConstructionAdminPack: protectedProcedure
    .input(
      z.object({
        projectName: z.string().min(2).max(300),
        phase: z
          .enum(["preconstruction", "construction", "handover"])
          .default("construction"),
      }),
    )
    .mutation(async ({ input }) => {
      return llmJson(
        `Construction contract administrator. Output JSON:\n{\n  submittalLog: [{ id, description, status, dueDate, reviewer }],\n  rfis: [{ id, question, response, status }],\n  changeOrders: [{ id, description, costImpact, scheduleImpact, status }],\n  siteInstructions: [{ date, instruction, issuedBy }],\n  meetingMinutes: [{ date, attendees, decisions }]\n}`,
        `Project: ${input.projectName}\nPhase: ${input.phase}`,
      );
    }),

  generateSnaggingList: protectedProcedure
    .input(
      z.object({
        areas: z.array(z.string()).max(50).default([]),
        projectName: z.string().min(2).max(300),
      }),
    )
    .mutation(async ({ input }) => {
      return llmJson(
        `Handover/snagging specialist. Output JSON:\n{\n  defects: [{ id, location, description, severity, trade, status, photoRef }],\n  punchListSummary: { open, closed, critical },\n  handoverChecklist: [string],\n  warrantyItems: [string]\n}`,
        `Project: ${input.projectName}\nAreas: ${input.areas.join(", ") || "whole building"}`,
      );
    }),

  generatePostOccupancyPlan: protectedProcedure
    .input(
      z.object({
        buildingType: z.string().min(3).max(200),
        sustainabilityTargets: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return llmJson(
        `Post-occupancy evaluation specialist. Output JSON:\n{\n  kpis: [{ metric, target, measurementMethod, frequency }],\n  energyMonitoring: { meters, benchmarks, reporting },\n  userFeedback: { surveys, channels, schedule },\n  lessonsLearned: [string],\n  continuousImprovement: [string]\n}`,
        `Type: ${input.buildingType}\nTargets: ${input.sustainabilityTargets ?? "standard efficiency"}`,
      );
    }),
};

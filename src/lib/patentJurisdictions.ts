export type PatentJurisdiction =
  "USPTO" | "IPONZ" | "EPO" | "IP_AUSTRALIA" | "UK_IPO" | "CIPO";

export type FilingType = "provisional" | "complete" | "non_provisional";

export type JurisdictionMeta = {
  id: PatentJurisdiction;
  label: string;
  defaultFilingType: FilingType;
  allowedFilingTypes: FilingType[];
  drawingStandard: "informal_ok_provisional" | "strict_black_ink";
  notes: string;
  specificationSections: string[];
};

export const PATENT_JURISDICTIONS: Record<
  PatentJurisdiction,
  JurisdictionMeta
> = {
  USPTO: {
    id: "USPTO",
    label: "United States (USPTO)",
    defaultFilingType: "provisional",
    allowedFilingTypes: ["provisional", "non_provisional"],
    drawingStandard: "informal_ok_provisional",
    notes:
      "Provisional applications accept informal drawings. Non-provisional requires formal drawings per 37 CFR 1.84.",
    specificationSections: [
      "title",
      "field",
      "background",
      "summary",
      "detailedDescription",
      "claims",
      "abstract",
    ],
  },
  IPONZ: {
    id: "IPONZ",
    label: "New Zealand (IPONZ)",
    defaultFilingType: "provisional",
    allowedFilingTypes: ["provisional", "complete"],
    drawingStandard: "informal_ok_provisional",
    notes:
      "Provisional requires title, description, and address for service. Complete specification follows within 15 months.",
    specificationSections: [
      "title",
      "field",
      "background",
      "summary",
      "detailedDescription",
      "claims",
      "addressForService",
    ],
  },
  EPO: {
    id: "EPO",
    label: "European Patent Office (EPO)",
    defaultFilingType: "complete",
    allowedFilingTypes: ["complete"],
    drawingStandard: "strict_black_ink",
    notes:
      "EPC Rule 46: black ink, uniform lines, reference signs, A4 margins.",
    specificationSections: [
      "title",
      "field",
      "background",
      "summary",
      "detailedDescription",
      "claims",
      "abstract",
    ],
  },
  IP_AUSTRALIA: {
    id: "IP_AUSTRALIA",
    label: "Australia (IP Australia)",
    defaultFilingType: "provisional",
    allowedFilingTypes: ["provisional", "complete"],
    drawingStandard: "informal_ok_provisional",
    notes: "Provisional patent application; complete within 12 months.",
    specificationSections: [
      "title",
      "field",
      "background",
      "summary",
      "detailedDescription",
      "claims",
    ],
  },
  UK_IPO: {
    id: "UK_IPO",
    label: "United Kingdom (UK IPO)",
    defaultFilingType: "provisional",
    allowedFilingTypes: ["provisional", "complete"],
    drawingStandard: "strict_black_ink",
    notes:
      "Formal drawings required for publication; line art standards apply.",
    specificationSections: [
      "title",
      "field",
      "background",
      "summary",
      "detailedDescription",
      "claims",
      "abstract",
    ],
  },
  CIPO: {
    id: "CIPO",
    label: "Canada (CIPO)",
    defaultFilingType: "provisional",
    allowedFilingTypes: ["provisional", "complete"],
    drawingStandard: "informal_ok_provisional",
    notes: "Canadian patent application; bilingual abstract may be required.",
    specificationSections: [
      "title",
      "field",
      "background",
      "summary",
      "detailedDescription",
      "claims",
      "abstract",
    ],
  },
};

export const PATENT_LEGAL_DISCLAIMER =
  "This tool assists with invention design and patent drafting only. It is not a substitute for a registered patent attorney or agent. Filing decisions, claim scope, and legal wording must be reviewed by a qualified professional before submission to any patent office.";

export function resolveFilingType(
  jurisdiction: PatentJurisdiction,
  requested?: FilingType,
): FilingType {
  const meta = PATENT_JURISDICTIONS[jurisdiction];
  if (requested && meta.allowedFilingTypes.includes(requested))
    return requested;
  return meta.defaultFilingType;
}

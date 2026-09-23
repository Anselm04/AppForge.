import type { EvidenceAuthority } from "./researchEvidence.js";

export type ResearchSourceRecord = {
  title: string;
  url: string;
  snippet: string;
  host: string;
  authority: EvidenceAuthority;
  score: number;
  provider: string;
  suspiciousInstructionText: boolean;
};

export type RejectedResearchSource = {
  url: string;
  reason: string;
};

export type ResearchDecision = {
  id: string;
  category:
    | "product"
    | "integration"
    | "deployment"
    | "monetization"
    | "security"
    | "framework"
    | "runtime";
  decision: string;
  rationale: string;
  sourceUrls: string[];
  confidence: "high" | "medium" | "low";
};

export type ResearchConflict = {
  topic: string;
  sourceUrls: string[];
  detail: string;
};

export type ResearchRecord = {
  version: 1;
  projectId: number;
  originalPrompt: string;
  productType: string;
  selectedTechnologyStack: string;
  queries: string[];
  providerFailures: string[];
  sources: ResearchSourceRecord[];
  rejectedSources: RejectedResearchSource[];
  uncertainty: string[];
  conflicts: ResearchConflict[];
  decisions: ResearchDecision[];
  briefMarkdown: string;
  searchedAt: string;
};

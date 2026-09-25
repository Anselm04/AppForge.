import type { WebSearchResult } from "../services/webSearch.js";
import type {
  RejectedResearchSource,
  ResearchConflict,
  ResearchSourceRecord,
} from "./researchRecord.js";

export type EvidenceAuthority =
  "official" | "repository" | "standards" | "vendor" | "community" | "unknown";

export type VerifiedEvidence = WebSearchResult & {
  host: string;
  authority: EvidenceAuthority;
  score: number;
  corroboratedByHosts: number;
  suspiciousInstructionText: boolean;
};

export type VerifiedResearchBrief = {
  markdown: string;
  sourceCount: number;
  highConfidenceCount: number;
  hosts: string[];
  rejectedSourceCount: number;
  suspiciousSourceCount: number;
  sources: ResearchSourceRecord[];
  rejectedSources: RejectedResearchSource[];
  conflicts: ResearchConflict[];
};

import { createHash } from "node:crypto";
import type { BuilderResourceManifestInput } from "./resourceManifest.js";

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bsk_(?:live|test)_[A-Za-z0-9]+\b/, "stripe-key"],
  [/\bgh[pousr]_[A-Za-z0-9_]+\b/, "github-token"],
  [/\b(?:api[_-]?key|secret|password|access[_-]?token)\s*[:=]\s*["'][^"']{8,}["']/i, "embedded-secret"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private-key"],
];

const PRIVATE_DATA_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:customer|tenant|patient|student)[_-]?(?:id|email|name)\s*[:=]/i, "customer-specific-field"],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, "email-address"],
];

export type ResourcePromotionScan = {
  safe: boolean;
  findings: Array<{ path: string; kind: string }>;
  contentHash: string;
};

export function scanResourcePromotionContent(
  files: Record<string, string>,
): ResourcePromotionScan {
  const findings: ResourcePromotionScan["findings"] = [];
  const ordered = Object.entries(files).sort(([left], [right]) =>
    left.localeCompare(right),
  );

  for (const [path, source] of ordered) {
    for (const [pattern, kind] of [...SECRET_PATTERNS, ...PRIVATE_DATA_PATTERNS]) {
      if (pattern.test(source)) findings.push({ path, kind });
      pattern.lastIndex = 0;
    }
  }

  const contentHash = createHash("sha256")
    .update(JSON.stringify(ordered))
    .digest("hex");

  return { safe: findings.length === 0, findings, contentHash };
}

export type ResourcePromotionCandidate = {
  generalizedFiles: Record<string, string>;
  proposedManifest: BuilderResourceManifestInput;
  scan: ResourcePromotionScan;
  automaticPromotionAllowed: false;
  requiredReviews: string[];
};

export function prepareResourcePromotionCandidate(input: {
  generalizedFiles: Record<string, string>;
  proposedManifest: BuilderResourceManifestInput;
}): ResourcePromotionCandidate {
  const scan = scanResourcePromotionContent(input.generalizedFiles);
  return {
    generalizedFiles: { ...input.generalizedFiles },
    proposedManifest: input.proposedManifest,
    scan,
    automaticPromotionAllowed: false,
    requiredReviews: [
      "deduplication",
      "generalization",
      "customer-data-removal",
      "secret-removal",
      "license-review",
      "security-review",
      "tests",
      "manifest-validation",
    ],
  };
}

export function assertPromotionCandidateSanitized(
  candidate: ResourcePromotionCandidate,
): void {
  if (!candidate.scan.safe) {
    throw new Error(
      `Builder Resource promotion blocked by sanitization findings: ${candidate.scan.findings
        .map((finding) => `${finding.path}:${finding.kind}`)
        .join(", ")}`,
    );
  }
  if (candidate.automaticPromotionAllowed !== false) {
    throw new Error("Builder Resource promotion must never be automatic");
  }
}

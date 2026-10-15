import type { BuilderResourceManifest } from "./resourceManifest.js";

const FORBIDDEN_PACKAGE_SPECIFIERS = [
  /^git\+/, /^git:/, /^https?:/, /^file:/, /^link:/,
];

const SECRET_VALUE_PATTERN =
  /(?:sk_(?:live|test)_[A-Za-z0-9]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;

export type ResourceSupplyChainFinding = {
  severity: "warning" | "error";
  code:
    | "missing-provenance"
    | "missing-license"
    | "disallowed-use"
    | "embedded-secret"
    | "unsafe-package-source"
    | "unpinned-package-policy"
    | "external-proprietary-copy";
  detail: string;
};

export type ResourceSupplyChainReview = {
  ok: boolean;
  findings: ResourceSupplyChainFinding[];
  packageCount: number;
};

export function reviewBuilderResourceSupplyChain(
  resource: BuilderResourceManifest,
): ResourceSupplyChainReview {
  const findings: ResourceSupplyChainFinding[] = [];

  if (!resource.governance.provenance.trim()) {
    findings.push({
      severity: "error",
      code: "missing-provenance",
      detail: "Resource provenance is required.",
    });
  }
  if (!resource.governance.license.trim()) {
    findings.push({
      severity: "error",
      code: "missing-license",
      detail: "Resource license metadata is required.",
    });
  }
  if (!resource.governance.allowedUse.includes("internal-generation")) {
    findings.push({
      severity: "error",
      code: "disallowed-use",
      detail: "Resource is not licensed/approved for internal generation use.",
    });
  }
  if (
    /external/i.test(resource.governance.provenance) &&
    /proprietary/i.test(resource.governance.license)
  ) {
    findings.push({
      severity: "error",
      code: "external-proprietary-copy",
      detail: "External proprietary source cannot be copied into the private resource warehouse.",
    });
  }

  const serializedContracts = JSON.stringify({
    contracts: resource.contracts,
    composition: resource.composition,
    adaptation: resource.adaptation,
  });
  if (SECRET_VALUE_PATTERN.test(serializedContracts)) {
    findings.push({
      severity: "error",
      code: "embedded-secret",
      detail: "Resource metadata contains a credential-like value.",
    });
  }

  for (const [packageName, version] of Object.entries(
    resource.composition.packages,
  )) {
    if (FORBIDDEN_PACKAGE_SPECIFIERS.some((pattern) => pattern.test(version))) {
      findings.push({
        severity: "error",
        code: "unsafe-package-source",
        detail: `${packageName} uses non-registry package source ${version}`,
      });
    }
    if (!/^(?:[~^]?\d+\.\d+\.\d+|\*|workspace:)/.test(version)) {
      findings.push({
        severity: "warning",
        code: "unpinned-package-policy",
        detail: `${packageName} has an unusual version constraint ${version}`,
      });
    }
  }

  return {
    ok: findings.every((finding) => finding.severity !== "error"),
    findings,
    packageCount: Object.keys(resource.composition.packages).length,
  };
}

export function assertBuilderResourceSupplyChainSafe(
  resource: BuilderResourceManifest,
): void {
  const review = reviewBuilderResourceSupplyChain(resource);
  if (!review.ok) {
    throw new Error(
      `Builder Resource supply-chain review failed: ${review.findings
        .filter((finding) => finding.severity === "error")
        .map((finding) => finding.code)
        .join(", ")}`,
    );
  }
}
